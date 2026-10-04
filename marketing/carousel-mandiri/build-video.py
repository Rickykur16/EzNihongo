"""Bangun video-carousel.html dari carousel.html: slide yang sama, dianimasikan per elemen (render(t) deterministik).
Pemakaian: python3 build-video.py"""
import re
src = open('carousel.html').read()
head = src[:src.index('<body>')]
body = src[src.index('<body>') + 6:src.index('</body>')]
extra_css = """
<style>
html,body{width:1080px;height:1920px;overflow:hidden;background:#111}
#stage{position:relative;width:1080px;height:1920px;overflow:hidden}
#stage .s{position:absolute;left:0;top:285px;margin:0;will-change:transform}
.bg{position:absolute;inset:0}
#bar{position:absolute;left:60px;right:60px;top:110px;height:10px;display:flex;gap:10px;z-index:50}
#bar i{flex:1;border-radius:5px;background:rgba(0,0,0,.18);overflow:hidden;position:relative}
#bar i b{position:absolute;left:0;top:0;bottom:0;width:0;background:#111;border-radius:5px}
#flash{position:absolute;inset:0;background:#fff;opacity:0;z-index:60}
</style>"""
script = open('video-motion.js').read()
html = head.replace('</head>', extra_css + '</head>') + '<body><div id="stage"><div class="bg" id="bg"></div><div id="bar">' + '<i><b></b></i>' * 7 + '</div>' + body + '<div id="flash"></div></div><script>' + script + '</script></body></html>'
open('video-carousel.html', 'w').write(html)
print('ok video-carousel.html')
