//
// SingularityCRM-Bridging-Header.h
// Exposes React Native ObjC types (RCTPromiseResolveBlock, etc.) to Swift files.
//
#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>
// Lets AppDelegate.swift read the current JS-controlled orientation lock.
#import "Orientation.h"
