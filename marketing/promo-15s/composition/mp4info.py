import struct, sys
data = open(sys.argv[1], 'rb').read()
def boxes(buf, off, end):
    while off < end:
        size, typ = struct.unpack('>I4s', buf[off:off + 8]); hdr = 8
        if size == 1: size = struct.unpack('>Q', buf[off + 8:off + 16])[0]; hdr = 16
        yield typ.decode('latin1'), off + hdr, off + size
        off += size
def find(buf, off, end, path):
    for typ, s, e in boxes(buf, off, end):
        if typ == path[0]:
            if len(path) == 1: yield s, e
            else: yield from find(buf, s, e, path[1:])
moov = next(find(data, 0, len(data), ['moov']))
s, e = next(find(data, *moov, ['mvhd']))
v = data[s]; ts, dur = (struct.unpack('>IQ', data[s + 20:s + 32]) if v == 1 else struct.unpack('>II', data[s + 12:s + 20]))
print(f'movie: {dur}/{ts} = {dur / ts:.6f} s')
for ts_, te in find(data, *moov, ['trak']):
    hs, he = next(find(data, ts_, te, ['mdia', 'hdlr'])); handler = data[hs + 8:hs + 12].decode()
    ms, me = next(find(data, ts_, te, ['mdia', 'mdhd'])); v = data[ms]
    mts, mdur = (struct.unpack('>IQ', data[ms + 20:ms + 32]) if v == 1 else struct.unpack('>II', data[ms + 12:ms + 20]))
    line = f'{handler}: media {mdur}/{mts} = {mdur / mts:.6f} s'
    for es, ee in find(data, ts_, te, ['edts', 'elst']):
        v = data[es]; n = struct.unpack('>I', data[es + 4:es + 8])[0]
        for i in range(n):
            if v == 1: sd, mt = struct.unpack('>Qq', data[es + 8 + i * 20:es + 24 + i * 20])
            else: sd, mt = struct.unpack('>Ii', data[es + 8 + i * 12:es + 16 + i * 12])
            line += f' | edit: duration {sd}/{ts} = {sd / ts:.6f} s, media_time {mt}'
    print(line)
