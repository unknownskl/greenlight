// gl-usb-reenumerate: asks macOS to re-enumerate one USB device, which is the
// software equivalent of unplugging and replugging it.
//
// Usage: gl-usb-reenumerate <locationID> <idVendor> <idProduct>
// The device must match all three values, so a stale or wrong locationID never
// touches a different device. Prints a single JSON line and exits 0 on success.

#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/IOKitLib.h>
#include <IOKit/IOCFPlugIn.h>
#include <IOKit/usb/IOUSBLib.h>
#include <stdio.h>
#include <stdlib.h>

static int get_number(io_service_t service, const char *key, long long *out) {
    CFStringRef cfkey = CFStringCreateWithCString(kCFAllocatorDefault, key, kCFStringEncodingUTF8);
    CFTypeRef value = IORegistryEntryCreateCFProperty(service, cfkey, kCFAllocatorDefault, 0);
    CFRelease(cfkey);
    if (value == NULL) return 0;
    int ok = CFGetTypeID(value) == CFNumberGetTypeID() && CFNumberGetValue((CFNumberRef)value, kCFNumberLongLongType, out);
    CFRelease(value);
    return ok;
}

static int fail(const char *step, kern_return_t kr) {
    printf("{\"ok\":false,\"step\":\"%s\",\"code\":\"0x%08x\"}\n", step, kr);
    return 1;
}

int main(int argc, char **argv) {
    if (argc != 4) {
        fprintf(stderr, "usage: %s <locationID> <idVendor> <idProduct>\n", argv[0]);
        return 2;
    }
    long long want_location = strtoll(argv[1], NULL, 0);
    long long want_vendor = strtoll(argv[2], NULL, 0);
    long long want_product = strtoll(argv[3], NULL, 0);

    io_iterator_t iter = 0;
    kern_return_t kr = IOServiceGetMatchingServices(kIOMainPortDefault, IOServiceMatching("IOUSBHostDevice"), &iter);
    if (kr != KERN_SUCCESS) return fail("match", kr);

    io_service_t found = 0, service;
    while ((service = IOIteratorNext(iter))) {
        long long location = -1, vendor = -1, product = -1;
        get_number(service, "locationID", &location);
        get_number(service, "idVendor", &vendor);
        get_number(service, "idProduct", &product);
        if (location == want_location && vendor == want_vendor && product == want_product) {
            found = service;
            break;
        }
        IOObjectRelease(service);
    }
    IOObjectRelease(iter);
    if (!found) return fail("find", kIOReturnNotFound);

    IOCFPlugInInterface **plugin = NULL;
    SInt32 score = 0;
    kr = IOCreatePlugInInterfaceForService(found, kIOUSBDeviceUserClientTypeID, kIOCFPlugInInterfaceID, &plugin, &score);
    IOObjectRelease(found);
    if (kr != KERN_SUCCESS || plugin == NULL) return fail("plugin", kr);

    IOUSBDeviceInterface320 **dev = NULL;
    HRESULT hr = (*plugin)->QueryInterface(plugin, CFUUIDGetUUIDBytes(kIOUSBDeviceInterfaceID320), (LPVOID *)&dev);
    (*plugin)->Release(plugin);
    if (hr != S_OK || dev == NULL) return fail("interface", (kern_return_t)hr);

    kr = (*dev)->USBDeviceOpen(dev);
    if (kr != kIOReturnSuccess) {
        (*dev)->Release(dev);
        return fail("open", kr);
    }

    kr = (*dev)->USBDeviceReEnumerate(dev, 0);
    (*dev)->USBDeviceClose(dev);
    (*dev)->Release(dev);
    if (kr != kIOReturnSuccess) return fail("reenumerate", kr);

    printf("{\"ok\":true}\n");
    return 0;
}
