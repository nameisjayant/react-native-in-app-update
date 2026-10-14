#import <XCTest/XCTest.h>
#import "InAppUpdateInfo.h"

static NSDate *Date(NSString *iso)
{
  return [[NSISO8601DateFormatter new] dateFromString:iso];
}

@interface InAppUpdateCompareVersionsTests : XCTestCase
@end

@implementation InAppUpdateCompareVersionsTests

- (void)testEqualVersions
{
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.2.3", @"1.2.3"), NSOrderedSame);
}

- (void)testMissingSegmentsCountAsZero
{
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.0", @"1.0.0"), NSOrderedSame);
  XCTAssertEqual(InAppUpdateCompareVersions(@"2", @"2.0"), NSOrderedSame);
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.0.1", @"1.0"), NSOrderedDescending);
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.0", @"1.0.1"), NSOrderedAscending);
}

- (void)testComparesNumericallyNotLexically
{
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.10", @"1.9"), NSOrderedDescending);
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.9", @"1.10"), NSOrderedAscending);
  XCTAssertEqual(InAppUpdateCompareVersions(@"10.0", @"9.9.9"), NSOrderedDescending);
}

- (void)testEarlierSegmentsWin
{
  XCTAssertEqual(InAppUpdateCompareVersions(@"2.0.0", @"1.99.99"), NSOrderedDescending);
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.2.9", @"1.3.0"), NSOrderedAscending);
}

- (void)testNonNumericSegmentsCountAsZero
{
  XCTAssertEqual(InAppUpdateCompareVersions(@"1.0.beta", @"1.0"), NSOrderedSame);
  XCTAssertEqual(InAppUpdateCompareVersions(@"", @"0"), NSOrderedSame);
}

@end

@interface InAppUpdateLookupURLTests : XCTestCase
@end

@implementation InAppUpdateLookupURLTests

- (NSDictionary<NSString *, NSString *> *)queryOf:(NSURL *)url
{
  NSMutableDictionary *query = [NSMutableDictionary dictionary];
  for (NSURLQueryItem *item in [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO].queryItems) {
    query[item.name] = item.value;
  }
  return query;
}

- (void)testLooksUpTheBundleIdInTheRegionalStore
{
  NSURL *url = InAppUpdateLookupURL(@"com.example.app", @"IN", [NSDate dateWithTimeIntervalSince1970:1700000000]);
  XCTAssertEqualObjects(url.scheme, @"https");
  XCTAssertEqualObjects(url.host, @"itunes.apple.com");
  XCTAssertEqualObjects(url.path, @"/lookup");
  NSDictionary *query = [self queryOf:url];
  XCTAssertEqualObjects(query[@"bundleId"], @"com.example.app");
  XCTAssertEqualObjects(query[@"country"], @"in");
}

- (void)testOmitsCountryForTheDefaultStore
{
  NSURL *url = InAppUpdateLookupURL(@"com.example.app", nil, NSDate.date);
  XCTAssertNil([self queryOf:url][@"country"]);
}

- (void)testAddsATimestampToBypassApplesCache
{
  NSURL *url = InAppUpdateLookupURL(@"com.example.app", nil, [NSDate dateWithTimeIntervalSince1970:1700000000]);
  XCTAssertEqualObjects([self queryOf:url][@"_"], @"1700000000");
}

- (void)testEscapesTheBundleId
{
  NSURL *url = InAppUpdateLookupURL(@"com.example.app&x=1", nil, NSDate.date);
  XCTAssertEqualObjects([self queryOf:url][@"bundleId"], @"com.example.app&x=1");
}

@end

@interface InAppUpdateAppFromLookupDataTests : XCTestCase
@end

@implementation InAppUpdateAppFromLookupDataTests

- (NSDictionary *)parse:(NSString *)json error:(NSError **)error
{
  return InAppUpdateAppFromLookupData([json dataUsingEncoding:NSUTF8StringEncoding], error);
}

- (void)testReturnsTheFirstResult
{
  NSError *error;
  NSDictionary *app = [self parse:@"{\"resultCount\":2,\"results\":[{\"version\":\"2.0\"},{\"version\":\"1.0\"}]}"
                            error:&error];
  XCTAssertNil(error);
  XCTAssertEqualObjects(app[@"version"], @"2.0");
}

- (void)testAppNotInStoreIsNilWithoutError
{
  NSError *error;
  XCTAssertNil([self parse:@"{\"resultCount\":0,\"results\":[]}" error:&error]);
  XCTAssertNil(error);
}

- (void)testNonObjectResultIsIgnored
{
  NSError *error;
  XCTAssertNil([self parse:@"{\"results\":[\"oops\"]}" error:&error]);
  XCTAssertNil(error);
}

- (void)testInvalidJsonIsAnError
{
  NSError *error;
  XCTAssertNil([self parse:@"<html>Service Unavailable</html>" error:&error]);
  XCTAssertEqualObjects(error.localizedDescription, @"Unexpected response from the App Store");
}

- (void)testMissingResultsIsAnError
{
  NSError *error;
  XCTAssertNil([self parse:@"{\"errorMessage\":\"Invalid value\"}" error:&error]);
  XCTAssertNotNil(error);
  XCTAssertNil([self parse:@"[]" error:&error]);
  XCTAssertNotNil(error);
}

- (void)testErrorPointerIsOptional
{
  XCTAssertNil(InAppUpdateAppFromLookupData([@"nope" dataUsingEncoding:NSUTF8StringEncoding], NULL));
}

@end

@interface InAppUpdateInfoForAppTests : XCTestCase
@end

@implementation InAppUpdateInfoForAppTests

- (NSDictionary *)infoFor:(NSDictionary *)app current:(NSString *)current
{
  return InAppUpdateInfoForApp(app, current, @"17.0", Date(@"2026-10-14T00:00:00Z"));
}

- (void)testNewerStoreVersionIsAvailable
{
  NSDictionary *info = [self infoFor:@{@"version" : @"2.1.0", @"releaseNotes" : @"Bug fixes"} current:@"2.0.0"];
  XCTAssertEqualObjects(info[@"updateAvailability"], @"available");
  XCTAssertEqualObjects(info[@"availableVersion"], @"2.1.0");
  XCTAssertEqualObjects(info[@"releaseNotes"], @"Bug fixes");
  XCTAssertEqualObjects(info[@"isImmediateAllowed"], @YES);
  XCTAssertEqualObjects(info[@"isFlexibleAllowed"], @YES);
}

- (void)testSameVersionIsNotAvailable
{
  NSDictionary *info = [self infoFor:@{@"version" : @"2.0"} current:@"2.0.0"];
  XCTAssertEqualObjects(info[@"updateAvailability"], @"not_available");
  XCTAssertEqualObjects(info[@"isImmediateAllowed"], @NO);
  XCTAssertEqualObjects(info[@"isFlexibleAllowed"], @NO);
  // Still reports what the store has.
  XCTAssertEqualObjects(info[@"availableVersion"], @"2.0");
}

- (void)testOlderStoreVersionIsNotAvailable
{
  // e.g. a TestFlight / dev build ahead of the store.
  XCTAssertEqualObjects([self infoFor:@{@"version" : @"1.9"} current:@"1.10"][@"updateAvailability"],
                        @"not_available");
}

- (void)testAppNotInStoreIsNotAvailable
{
  NSDictionary *info = [self infoFor:nil current:@"1.0"];
  XCTAssertEqualObjects(info[@"updateAvailability"], @"not_available");
  XCTAssertEqualObjects(info[@"availableVersion"], @"");
  XCTAssertEqualObjects(info[@"releaseNotes"], @"");
  XCTAssertEqualObjects(info[@"clientVersionStalenessDays"], @(-1));
}

- (void)testUnknownInstalledVersionIsNotAvailable
{
  XCTAssertEqualObjects([self infoFor:@{@"version" : @"2.0"} current:nil][@"updateAvailability"], @"not_available");
}

- (void)testNonStringFieldsAreIgnored
{
  NSDictionary *info = [self infoFor:@{@"version" : @2, @"releaseNotes" : @[]} current:@"1.0"];
  XCTAssertEqualObjects(info[@"updateAvailability"], @"not_available");
  XCTAssertEqualObjects(info[@"availableVersion"], @"");
  XCTAssertEqualObjects(info[@"releaseNotes"], @"");
}

- (void)testUpdateNeedingANewerOSIsNotAvailable
{
  NSDictionary *app = @{@"version" : @"3.0", @"minimumOsVersion" : @"18.0"};
  XCTAssertEqualObjects([self infoFor:app current:@"2.0"][@"updateAvailability"], @"not_available");
}

- (void)testUpdateForThisOSOrOlderIsAvailable
{
  NSDictionary *same = @{@"version" : @"3.0", @"minimumOsVersion" : @"17.0"};
  NSDictionary *older = @{@"version" : @"3.0", @"minimumOsVersion" : @"15.1"};
  XCTAssertEqualObjects([self infoFor:same current:@"2.0"][@"updateAvailability"], @"available");
  XCTAssertEqualObjects([self infoFor:older current:@"2.0"][@"updateAvailability"], @"available");
}

- (void)testStalenessIsWholeDaysSinceRelease
{
  NSDictionary *app = @{@"version" : @"2.0", @"currentVersionReleaseDate" : @"2026-10-10T12:00:00Z"};
  XCTAssertEqualObjects([self infoFor:app current:@"1.0"][@"clientVersionStalenessDays"], @3);
}

- (void)testStalenessIsNeverNegative
{
  // Device clock behind Apple's.
  NSDictionary *app = @{@"version" : @"2.0", @"currentVersionReleaseDate" : @"2026-10-20T00:00:00Z"};
  XCTAssertEqualObjects([self infoFor:app current:@"1.0"][@"clientVersionStalenessDays"], @0);
}

- (void)testStalenessIsUnknownWithoutAnUpdate
{
  NSDictionary *app = @{@"version" : @"1.0", @"currentVersionReleaseDate" : @"2026-10-01T00:00:00Z"};
  XCTAssertEqualObjects([self infoFor:app current:@"1.0"][@"clientVersionStalenessDays"], @(-1));
}

- (void)testStalenessIsUnknownForBadDates
{
  NSDictionary *app = @{@"version" : @"2.0", @"currentVersionReleaseDate" : @"last tuesday"};
  XCTAssertEqualObjects([self infoFor:app current:@"1.0"][@"clientVersionStalenessDays"], @(-1));
}

- (void)testPlayOnlyFieldsAreZero
{
  NSDictionary *info = [self infoFor:@{@"version" : @"2.0"} current:@"1.0"];
  XCTAssertEqualObjects(info[@"installStatus"], @"unknown");
  XCTAssertEqualObjects(info[@"availableVersionCode"], @0);
  XCTAssertEqualObjects(info[@"updatePriority"], @0);
  XCTAssertEqualObjects(info[@"bytesDownloaded"], @0);
  XCTAssertEqualObjects(info[@"totalBytesToDownload"], @0);
}

- (void)testExposesEveryFieldJSExpects
{
  NSSet *keys = [NSSet setWithArray:[self infoFor:nil current:@"1.0"].allKeys];
  NSSet *expected = [NSSet setWithArray:@[
    @"updateAvailability", @"installStatus", @"availableVersionCode", @"availableVersion", @"releaseNotes",
    @"isImmediateAllowed", @"isFlexibleAllowed", @"clientVersionStalenessDays", @"updatePriority",
    @"bytesDownloaded", @"totalBytesToDownload"
  ]];
  XCTAssertEqualObjects(keys, expected);
}

@end
