#import <InAppUpdateSpec/InAppUpdateSpec.h>

// iOS has no Play-style in-app updates: the module checks the App Store
// listing and shows it in-app so the user can update.
@interface InAppUpdate : NativeInAppUpdateSpecBase <NativeInAppUpdateSpec>

@end
