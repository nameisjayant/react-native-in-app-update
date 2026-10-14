#import <InAppUpdateSpec/InAppUpdateSpec.h>

// Play in-app updates are Android-only; on iOS the module reports "unsupported".
@interface InAppUpdate : NativeInAppUpdateSpecBase <NativeInAppUpdateSpec>

@end
