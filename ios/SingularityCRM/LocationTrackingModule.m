#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LocationTrackingModule, NSObject)

RCT_EXTERN_METHOD(checkPermission:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestPermission:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// pingPath/batchPath select the tier (B2B vs B2C). The bridge signature must match the Swift
// selector exactly, so adding parameters here and there is a single, paired change.
RCT_EXTERN_METHOD(startTracking:(NSString *)token
                  apiBaseUrl:(NSString *)apiBaseUrl
                  pingPath:(NSString *)pingPath
                  batchPath:(NSString *)batchPath
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateAuthToken:(NSString *)token
                  apiBaseUrl:(NSString *)apiBaseUrl
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopTracking:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateGeofences:(NSArray *)schools
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearGeofences:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
