"""Local release QA server. --slow shares a 10 Mbps budget across all requests."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
import argparse, threading, time
p=argparse.ArgumentParser();p.add_argument('--slow',action='store_true');p.add_argument('--port',type=int,default=8879);a=p.parse_args()
lock=threading.Lock()
class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if a.slow: time.sleep(.1)
        super().do_GET()
    def copyfile(self,source,outputfile):
        if not a.slow: return super().copyfile(source,outputfile)
        while data:=source.read(65536):
            with lock:
                outputfile.write(data);outputfile.flush();time.sleep(len(data)/1250000)
    def log_message(self,*args): pass
ThreadingHTTPServer(('127.0.0.1',a.port),partial(Handler,directory='dist/web')).serve_forever()
