#import "InAppUpdate.h"

@implementation InAppUpdate

- (void)checkForUpdate:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  resolve(@{
    @"updateAvailability" : @"unsupported",
    @"installStatus" : @"unknown",
    @"availableVersionCode" : @0,
    @"isImmediateAllowed" : @NO,
    @"isFlexibleAllowed" : @NO,
    @"clientVersionStalenessDays" : @-1,
    @"updatePriority" : @0,
    @"bytesDownloaded" : @0,
    @"totalBytesToDownload" : @0,
  });
}

- (void)startUpdate:(NSString *)type
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  reject(@"E_UNSUPPORTED", @"In-app updates are only available on Android", nil);
}

- (void)completeUpdate:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  resolve(nil);
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
