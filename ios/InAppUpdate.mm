#import "InAppUpdate.h"
#import "InAppUpdateInfo.h"
#import <React/RCTUtils.h>
#import <StoreKit/StoreKit.h>

typedef void (^InAppUpdateLookupCompletion)(NSDictionary *_Nullable app, NSError *_Nullable error);

// iOS has no in-app update API: we look the app up on the App Store, compare
// versions, and show its App Store page in-app (SKStoreProductViewController).
@interface InAppUpdate () <SKStoreProductViewControllerDelegate>
@end

@implementation InAppUpdate {
  // Resolves the pending startUpdate once the App Store sheet closes. Main thread only.
  RCTPromiseResolveBlock _storeResolve;
}

- (void)checkForUpdate:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  NSString *systemVersion = UIDevice.currentDevice.systemVersion;
  [self lookupApp:^(NSDictionary *app, NSError *error) {
    if (error) {
      reject(@"E_CHECK_FAILED", error.localizedDescription, error);
      return;
    }
    resolve([self updateInfoForApp:app systemVersion:systemVersion]);
  }];
}

- (void)startUpdate:(NSString *)type
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  // `type` doesn't apply on iOS: both flows show the App Store page.
  NSString *systemVersion = UIDevice.currentDevice.systemVersion;
  [self lookupApp:^(NSDictionary *app, NSError *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (error) {
        reject(@"E_CHECK_FAILED", error.localizedDescription, error);
        return;
      }
      NSDictionary *info = [self updateInfoForApp:app systemVersion:systemVersion];
      NSNumber *trackId = app[@"trackId"];
      if (![info[@"updateAvailability"] isEqualToString:@"available"] ||
          ![trackId isKindOfClass:NSNumber.class]) {
        reject(@"E_NOT_AVAILABLE", @"No update is available on the App Store", nil);
        return;
      }
      if (self->_storeResolve) {
        reject(@"E_IN_PROGRESS", @"The App Store page is already showing", nil);
        return;
      }
      [self presentStoreForTrackId:trackId resolve:resolve reject:reject];
    });
  }];
}

- (void)completeUpdate:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  // The App Store installs updates itself; there's nothing to complete.
  resolve(nil);
}

#pragma mark - App Store lookup

- (void)lookupApp:(InAppUpdateLookupCompletion)completion
{
  NSString *bundleId = NSBundle.mainBundle.bundleIdentifier;
  NSString *country = [NSLocale.currentLocale objectForKey:NSLocaleCountryCode];
  [self lookupApp:bundleId country:country completion:^(NSDictionary *app, NSError *error) {
    if (app || error || !country) {
      completion(app, error);
      return;
    }
    // Not in the store for the device's region; try the default (US) store.
    [self lookupApp:bundleId country:nil completion:completion];
  }];
}

- (void)lookupApp:(NSString *)bundleId
          country:(nullable NSString *)country
       completion:(InAppUpdateLookupCompletion)completion
{
  NSURLRequest *request = [NSURLRequest requestWithURL:InAppUpdateLookupURL(bundleId, country, NSDate.date)
                                           cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                       timeoutInterval:15];
  [[NSURLSession.sharedSession
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          if (error || !data) {
            completion(nil, error ?: InAppUpdateError(@"Empty response from the App Store"));
            return;
          }
          NSError *parseError;
          NSDictionary *app = InAppUpdateAppFromLookupData(data, &parseError);
          completion(app, parseError);
        }] resume];
}

- (NSDictionary *)updateInfoForApp:(nullable NSDictionary *)app systemVersion:(NSString *)systemVersion
{
  return InAppUpdateInfoForApp(
      app, NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"], systemVersion, NSDate.date);
}

#pragma mark - App Store page

- (void)presentStoreForTrackId:(NSNumber *)trackId
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  _storeResolve = resolve;
  SKStoreProductViewController *store = [SKStoreProductViewController new];
  store.delegate = self;
  // Swipe-to-dismiss wouldn't tell the delegate; make "Done" the only way out.
  store.modalInPresentation = YES;
  [store loadProductWithParameters:@{SKStoreProductParameterITunesItemIdentifier : trackId}
                   completionBlock:^(BOOL loaded, NSError *error) {
                     dispatch_async(dispatch_get_main_queue(), ^{
                       UIViewController *presenter = RCTPresentedViewController();
                       if (!loaded || !presenter) {
                         self->_storeResolve = nil;
                         [self openAppStoreForTrackId:trackId resolve:resolve reject:reject];
                         return;
                       }
                       [presenter presentViewController:store animated:YES completion:nil];
                     });
                   }];
}

- (void)productViewControllerDidFinish:(SKStoreProductViewController *)viewController
{
  RCTPromiseResolveBlock resolve = _storeResolve;
  _storeResolve = nil;
  // The App Store doesn't say whether the user updated. If they did, iOS
  // relaunches the app on the new version, so getting here means "not yet".
  // Resolve after the sheet is gone so a mandatory re-prompt can present again.
  [viewController dismissViewControllerAnimated:YES
                                     completion:^{
                                       if (resolve) resolve(@"canceled");
                                     }];
}

// Fallback when the in-app sheet can't load: leave for the App Store app.
- (void)openAppStoreForTrackId:(NSNumber *)trackId
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"itms-apps://apps.apple.com/app/id%@", trackId]];
  [UIApplication.sharedApplication
                openURL:url
                options:@{}
      completionHandler:^(BOOL opened) {
        if (!opened) {
          reject(@"E_START_FAILED", @"Couldn't open the App Store", nil);
          return;
        }
        // Settle once the user is back, like the in-app sheet.
        __block id observer =
            [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationDidBecomeActiveNotification
                                                            object:nil
                                                             queue:NSOperationQueue.mainQueue
                                                        usingBlock:^(NSNotification *note) {
                                                          [NSNotificationCenter.defaultCenter removeObserver:observer];
                                                          observer = nil;
                                                          resolve(@"canceled");
                                                        }];
      }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeInAppUpdateSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"InAppUpdate";
}

@end
