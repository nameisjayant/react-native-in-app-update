#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// App Store lookup → JS translation. Foundation only, so it can be unit tested
// without React Native (see ios/Tests).

/// Compares dotted versions segment by segment, so "1.10" > "1.9" and "1.0" == "1.0.0".
FOUNDATION_EXTERN NSComparisonResult InAppUpdateCompareVersions(NSString *a, NSString *b);

/// iTunes lookup URL for `bundleId`, in the `country` store (nil = default US store).
FOUNDATION_EXTERN NSURL *InAppUpdateLookupURL(NSString *bundleId, NSString *_Nullable country, NSDate *now);

/// First app in an iTunes lookup response. nil with `error` set when the response is malformed,
/// nil without an error when the app isn't in that store.
FOUNDATION_EXTERN NSDictionary *_Nullable InAppUpdateAppFromLookupData(NSData *data, NSError **error);

/// The `NativeUpdateInfo` JS expects, for the installed `currentVersion` against the store `app`.
FOUNDATION_EXTERN NSDictionary *InAppUpdateInfoForApp(NSDictionary *_Nullable app,
                                                      NSString *_Nullable currentVersion,
                                                      NSString *systemVersion,
                                                      NSDate *now);

FOUNDATION_EXTERN NSError *InAppUpdateError(NSString *message);

NS_ASSUME_NONNULL_END
