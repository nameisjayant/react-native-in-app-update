#import "InAppUpdateInfo.h"

static NSString *InAppUpdateString(id value)
{
  return [value isKindOfClass:NSString.class] ? value : nil;
}

NSComparisonResult InAppUpdateCompareVersions(NSString *a, NSString *b)
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

NSURL *InAppUpdateLookupURL(NSString *bundleId, NSString *country, NSDate *now)
{
  NSURLComponents *components = [NSURLComponents componentsWithString:@"https://itunes.apple.com/lookup"];
  NSMutableArray<NSURLQueryItem *> *query = [NSMutableArray arrayWithObjects:
      [NSURLQueryItem queryItemWithName:@"bundleId" value:bundleId],
      // Apple's CDN caches lookups for hours; a unique parameter gets a fresh answer.
      [NSURLQueryItem queryItemWithName:@"_"
                                  value:[NSString stringWithFormat:@"%.0f", now.timeIntervalSince1970]],
      nil];
  if (country) [query addObject:[NSURLQueryItem queryItemWithName:@"country" value:country.lowercaseString]];
  components.queryItems = query;
  return components.URL;
}

NSDictionary *InAppUpdateAppFromLookupData(NSData *data, NSError **error)
{
  NSDictionary *json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  NSArray *results = [json isKindOfClass:NSDictionary.class] ? json[@"results"] : nil;
  if (![results isKindOfClass:NSArray.class]) {
    if (error) *error = InAppUpdateError(@"Unexpected response from the App Store");
    return nil;
  }
  NSDictionary *app = results.firstObject;
  return [app isKindOfClass:NSDictionary.class] ? app : nil;
}

NSDictionary *InAppUpdateInfoForApp(NSDictionary *app, NSString *currentVersion, NSString *systemVersion, NSDate *now)
{
  NSString *current = InAppUpdateString(currentVersion);
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
    if (date) stalenessDays = MAX(0, (NSInteger)floor([now timeIntervalSinceDate:date] / 86400));
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

NSError *InAppUpdateError(NSString *message)
{
  return [NSError errorWithDomain:@"InAppUpdate" code:1 userInfo:@{NSLocalizedDescriptionKey : message}];
}
