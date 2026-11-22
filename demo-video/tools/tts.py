import certifi, asyncio, json, subprocess, os
certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
import edge_tts
D=os.path.dirname(os.path.abspath(__file__)); os.makedirs(D+"/audio",exist_ok=True)
says=json.load(open(D+"/beats.json"))
async def one(i,t):
    f=f"{D}/audio/{i:02d}.mp3"
    if not os.path.exists(f):
        await edge_tts.Communicate(t,"en-US-AvaNeural",rate="-4%").save(f)
    return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f]))
async def main():
    durs=[await one(i,t) for i,t in enumerate(says)]
    json.dump(durs,open(D+"/durations.json","w")); print(round(sum(durs)),"s total")
asyncio.run(main())
