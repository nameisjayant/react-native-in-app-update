#import "InAppUpdate.h"
#import <React/RCTUtils.h>
#import <StoreKit/StoreKit.h>

typedef void (^InAppUpdateLookupCompletion)(NSDictionary *_Nullable app, NSError *_Nullable error);

// Compares dotted versions segment by segment, so "1.10" > "1.9" and "1.0" == "1.0.0".
static NSComparisonResult InAppUpdateCompareVersions(NSString *a, NSString *b)
{
  NSArray<NSString *> *pa = [a componentsSeparatedByString:@"."];
  NSArray<NSString *> *pb = [b componentsSeparatedByString:@"."];
  NSUInteger count = MAX(pa.count, pb.count);
  for (NSUInteger i = 0; i < count; i++) {
    NSInteger x = i < pa.count ? pa[i].integerValue : 0;
    NSInteger y = i < pb.count ? pb[i].integerValue : 0;
    if (x != y) return x > y ? NSOrderedDescending : NSOrderedAscending;
  }
  return NSOrderedSame;
}

static NSString *InAppUpdateString(id value)
{
  return [value isKindOfClass:NSString.class] ? value : nil;
}

static NSError *InAppUpdateError(NSString *message)
{
  return [NSError errorWithDomain:@"InAppUpdate" code:1 userInfo:@{NSLocalizedDescriptionKey : message}];
}

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
  NSURLComponents *components = [NSURLComponents componentsWithString:@"https://itunes.apple.com/lookup"];
  NSMutableArray<NSURLQueryItem *> *query = [NSMutableArray arrayWithObjects:
      [NSURLQueryItem queryItemWithName:@"bundleId" value:bundleId],
      // Apple's CDN caches lookups for hours; a unique parameter gets a fresh answer.
      [NSURLQueryItem queryItemWithName:@"_"
                                  value:[NSString stringWithFormat:@"%.0f", NSDate.date.timeIntervalSince1970]],
      nil];
  if (country) [query addObject:[NSURLQueryItem queryItemWithName:@"country" value:country.lowercaseString]];
  components.queryItems = query;

  NSURLRequest *request = [NSURLRequest requestWithURL:components.URL
                                           cachePolicy:NSURLRequestReloadIgnoringLocalCacheData
                                       timeoutInterval:15];
  [[NSURLSession.sharedSession
      dataTaskWithRequest:request
        completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
          if (error || !data) {
            completion(nil, error ?: InAppUpdateError(@"Empty response from the App Store"));
            return;
          }
          NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
          NSArray *results = [json isKindOfClass:NSDictionary.class] ? json[@"results"] : nil;
          if (![results isKindOfClass:NSArray.class]) {
            completion(nil, InAppUpdateError(@"Unexpected response from the App Store"));
            return;
          }
          NSDictionary *app = results.firstObject;
          completion([app isKindOfClass:NSDictionary.class] ? app : nil, nil);
        }] resume];
}

- (NSDictionary *)updateInfoForApp:(nullable NSDictionary *)app systemVersion:(NSString *)systemVersion
{
  NSString *current = InAppUpdateString(NSBundle.mainBundle.infoDictionary[@"CFBundleShortVersionString"]);
  NSString *storeVersion = InAppUpdateString(app[@"version"]);
  NSString *minimumOs = InAppUpdateString(app[@"minimumOsVersion"]);
  // A newer version this device can't install isn't an update for it.
  BOOL installable = !minimumOs || InAppUpdateCompareVersions(systemVersion, minimumOs) != NSOrderedAscending;
  BOOL available = current && storeVersion && installable &&
      InAppUpdateCompareVersions(storeVersion, current) == NSOrderedDescending;

  NSInteger stalenessDays = -1;
  NSString *releaseDate = InAppUpdateString(app[@"currentVersionReleaseDate"]);
  if (available && releaseDate) {
    NSDate *date = [[NSISO8601DateFormatter new] dateFromString:releaseDate];
    if (date) stalenessDays = MAX(0, (NSInteger)floor(-date.timeIntervalSinceNow / 86400));
  }

  return @{
    @"updateAvailability" : available ? @"available" : @"not_available",
    @"installStatus" : @"unknown",
    @"availableVersionCode" : @0,
    @"availableVersion" : storeVersion ?: @"",
    @"releaseNotes" : InAppUpdateString(app[@"releaseNotes"]) ?: @"",
    @"isImmediateAllowed" : @(available),
    @"isFlexibleAllowed" : @(available),
    @"clientVersionStalenessDays" : @(stalenessDays),
    @"updatePriority" : @0,
    @"bytesDownloaded" : @0,
    @"totalBytesToDownload" : @0,
  };
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
