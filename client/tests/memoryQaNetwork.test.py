import struct
import unittest
from unittest.mock import patch
from memoryQaNetwork import attributes, integer, ip, messages, interface_address, dump


class FakeSocket:
    def __init__(self, replies):
        self.replies = iter(replies)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def settimeout(self, value):
        pass

    def bind(self, value):
        pass

    def getsockname(self):
        return (7, 0)

    def sendto(self, data, destination):
        assert destination == (0, 0)

    def recvmsg(self, size):
        try:
            return next(self.replies)
        except StopIteration:
            raise TimeoutError("No complete dump")


class ParserSafety(unittest.TestCase):
    def test_sockaddr_layout_includes_zero_port(self):
        packed = interface_address("127.0.0.1")
        self.assertEqual(len(packed), 32)
        self.assertEqual(packed[18:20], b"\0\0")
        self.assertEqual(packed[20:24], b"\x7f\0\0\1")

    def test_valid_attribute(self):
        self.assertEqual(attributes(struct.pack("=HHI", 8, 4, 1)), {4: struct.pack("=I", 1)})

    def test_incomplete_attributes(self):
        for data in (b"\0", struct.pack("=HH", 3, 1), struct.pack("=HH", 9, 1),
                     struct.pack("=HH", 4, 1) * 2):
            with self.assertRaises(ValueError):
                attributes(data)

    def test_typed_values(self):
        self.assertEqual(ip(b"\x7f\0\0\1", 2), "127.0.0.1")
        for value, family in [(b"", 2), (b"\0" * 4, 10), (b"\0" * 4, 99)]:
            with self.assertRaises(ValueError):
                ip(value, family)
        with self.assertRaises(ValueError):
            integer({4: b"\0"}, 4)

    def test_complete_message(self):
        self.assertEqual(messages(struct.pack("=IHHII", 16, 3, 2, 1, 7), 1, 7), [(3, b"")])

    def test_incomplete_or_interrupted_messages(self):
        for data in (b"\0", struct.pack("=IHHII", 17, 3, 2, 1, 7),
                     struct.pack("=IHHII", 16, 3, 0x12, 1, 7),
                     struct.pack("=IHHII", 16, 3, 0, 1, 7)):
            with self.assertRaises(ValueError):
                messages(data, 1, 7)

    def test_wrong_sequence_or_sender(self):
        for seq, port in [(2, 7), (1, 8)]:
            with self.assertRaises(ValueError):
                messages(struct.pack("=IHHII", 16, 3, 2, seq, port), 1, 7)

    def test_dump_requires_kernel_sender_and_complete_done(self):
        done = struct.pack("=IHHII", 16, 3, 2, 1, 7)
        invalid_done = struct.pack("=IHHII", 20, 3, 2, 1, 7) + b"\1\0\0\0"
        reply = lambda data, flags=0, sender=0: (data, [], flags, (sender, 0))
        cases = [
            [], [reply(done, flags=32)], [reply(done, sender=8)],
            [reply(invalid_done)], [reply(done + done)],
            [reply(struct.pack("=IHHII", 16, 2, 2, 1, 7))],
        ]
        for replies in cases:
            with self.subTest(replies=replies), patch("memoryQaNetwork.socket.socket", return_value=FakeSocket(replies)):
                with self.assertRaises((ValueError, TimeoutError)):
                    dump(18, 16, b"")

    def test_successful_empty_dump(self):
        done = struct.pack("=IHHII", 20, 3, 2, 1, 7) + b"\0" * 4
        with patch("memoryQaNetwork.socket.socket", return_value=FakeSocket([(done, [], 0, (0, 0))])):
            self.assertEqual(dump(18, 16, b""), [])


if __name__ == "__main__":
    unittest.main()
