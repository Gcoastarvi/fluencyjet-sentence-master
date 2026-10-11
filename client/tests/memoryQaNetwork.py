"""Kernel-only namespace inventory/loopback setup; never opens internet sockets."""
import fcntl
import ipaddress
import json
import os
import socket
import struct
import sys


def attributes(data):
    result = {}
    offset = 0
    while offset < len(data):
        if len(data) - offset < 4:
            raise ValueError("Incomplete netlink attribute")
        size, kind = struct.unpack_from("=HH", data, offset)
        if size < 4 or offset + size > len(data) or kind in result:
            raise ValueError("Invalid/duplicate netlink attribute")
        result[kind] = data[offset + 4:offset + size]
        offset += (size + 3) & ~3
    if offset != len(data):
        raise ValueError("Incomplete attribute alignment")
    return result


def integer(attrs, key, default=0):
    value = attrs.get(key)
    if value is None:
        return default
    if len(value) != 4:
        raise ValueError("Invalid integer attribute")
    return struct.unpack("=I", value)[0]


def ip(value, family):
    size = {2: 4, 10: 16}.get(family)
    if size is None or len(value) != size:
        raise ValueError("Invalid address family/size")
    return str(ipaddress.ip_address(value))


def messages(data, sequence, port):
    offset = 0
    result = []
    while offset < len(data):
        if len(data) - offset < 16:
            raise ValueError("Incomplete netlink header")
        size, kind, flags, seq, pid = struct.unpack_from("=IHHII", data, offset)
        if size < 16 or offset + size > len(data) or seq != sequence or pid != port:
            raise ValueError("Invalid netlink message")
        if flags & 0x10 or not flags & 2:  # DUMP_INTR / missing MULTI
            raise ValueError("Incomplete/interrupted dump")
        result.append((kind, data[offset + 16:offset + size]))
        offset += (size + 3) & ~3
    if offset != len(data):
        raise ValueError("Incomplete message alignment")
    return result


def dump(request, response, payload):
    with socket.socket(socket.AF_NETLINK, socket.SOCK_RAW, socket.NETLINK_ROUTE) as sock:
        sock.settimeout(3)
        sock.bind((0, 0))
        port = sock.getsockname()[0]
        sock.sendto(struct.pack("=IHHII", 16 + len(payload), request, 0x301, 1, port) + payload, (0, 0))
        result = []
        while True:
            data, _, flags, sender = sock.recvmsg(1 << 20)
            if not data or flags & socket.MSG_TRUNC or sender[0] != 0:
                raise ValueError("Truncated/non-kernel dump")
            batch = messages(data, 1, port)
            for n, (kind, body) in enumerate(batch):
                if kind == 3:  # NLMSG_DONE must terminate a complete dump.
                    if body not in (b"", b"\0\0\0\0") or n != len(batch) - 1:
                        raise ValueError("Invalid dump termination")
                    return result
                if kind != response:
                    raise ValueError("Unexpected message/error in dump")
                result.append(body)


def inventory():
    links = []
    for body in dump(18, 16, struct.pack("=BBHiII", 0, 0, 0, 0, 0, 0)):
        if len(body) < 16:
            raise ValueError("Short link")
        _, _, hardware, index, flags, _ = struct.unpack_from("=BBHiII", body)
        attrs = attributes(body[16:])
        name = attrs[3]
        if not name.endswith(b"\0") or b"\0" in name[:-1]:
            raise ValueError("Invalid interface name")
        links.append(dict(name=name[:-1].decode("ascii"), index=index, hardware=hardware,
                          flags=flags, master=integer(attrs, 10), linked=integer(attrs, 5)))
    addresses = []
    for body in dump(22, 20, struct.pack("=BBBBI", 0, 0, 0, 0, 0)):
        if len(body) < 8:
            raise ValueError("Short address")
        family, prefix, _, scope, index = struct.unpack_from("=BBBBI", body)
        attrs = attributes(body[8:])
        values = [ip(attrs[k], family) for k in (1, 2) if k in attrs]
        if not values:
            raise ValueError("Address missing IP")
        addresses.append(dict(family=family, prefix=prefix, scope=scope, index=index, values=values))
    routes = []
    for body in dump(26, 24, struct.pack("=BBBBBBBBI", 0, 0, 0, 0, 0, 0, 0, 0, 0)):
        if len(body) < 12:
            raise ValueError("Short route")
        family, prefix, source_prefix, tos, table, protocol, scope, kind, flags = struct.unpack_from("=BBBBBBBBI", body)
        attrs = attributes(body[12:])
        routes.append(dict(family=family, prefix=prefix, sourcePrefix=source_prefix, tos=tos,
                           table=integer(attrs, 15, table), protocol=protocol, scope=scope,
                           type=kind, flags=flags, index=integer(attrs, 4),
                           destination=ip(attrs[1], family) if 1 in attrs else None,
                           preferredSource=ip(attrs[7], family) if 7 in attrs else None,
                           attributeTypes=sorted(attrs)))
    return dict(complete=True, namespace=os.readlink("/proc/self/ns/net"),
                links=sorted(links, key=lambda x: x["index"]),
                addresses=sorted(addresses, key=lambda x: json.dumps(x, sort_keys=True)),
                routes=sorted(routes, key=lambda x: json.dumps(x, sort_keys=True)))


def interface_address(value):
    # sockaddr_in includes the two-byte port BEFORE the four-byte IPv4 address.
    return struct.pack("=16sH2x4s8x", b"lo", socket.AF_INET, socket.inet_aton(value))


def setup_loopback():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        fcntl.ioctl(sock, 0x8916, interface_address("127.0.0.1"))  # SIOCSIFADDR
        fcntl.ioctl(sock, 0x891c, interface_address("255.0.0.0"))  # SIOCSIFNETMASK
        request = struct.pack("=16sH14x", b"lo", 0)
        flags = struct.unpack("=16sH14x", fcntl.ioctl(sock, 0x8913, request))[1]
        fcntl.ioctl(sock, 0x8914, struct.pack("=16sH14x", b"lo", flags | 1))


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--setup":
        setup_loopback()
    elif len(sys.argv) != 1:
        raise ValueError("Unexpected arguments")
    print(json.dumps(inventory(), sort_keys=True))
