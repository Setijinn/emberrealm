import random, json
from collections import deque
random.seed(20260724)  # deterministic (Math.random unavailable in-engine; bake it)

W = 64
ZONE_H = 96
NZ = 9
H = ZONE_H * NZ
CX = W // 2

def band_of(y):
    return max(0, min(NZ-1, int((1 - y/(H-1)) * NZ)))

# GROUND-ONLY weights per band (no t/k here — obstacles are placed as organic clumps below,
# not sprinkled per-tile, which is what made the old map look like grid noise with no lanes).
ZONE = [
  ("Roothollow Vale", 1,   {'g':78,'d':14,'r':8}),
  ("Mistwood",       12,   {'g':66,'d':10,'r':24}),
  ("Bramblemarch",   25,   {'g':60,'r':22,'d':16,'e':2}),
  ("Greystone Foothills",41,{'d':40,'r':44,'g':12,'e':4}),
  ("Wind Crags",     59,   {'r':52,'d':38,'e':6,'g':4}),
  ("Emberscar Ridge",78,   {'r':44,'d':36,'e':16,'g':4}),
  ("Ashfall Reach",  98,   {'d':54,'r':28,'e':18}),
  ("Cinderspire",   118,   {'e':33,'r':40,'d':27}),
  ("Molten Crown",  139,   {'e':47,'r':37,'d':16}),
]

def pick(weights):
    tot=sum(weights.values()); r=random.uniform(0,tot); a=0
    for k,v in weights.items():
        a+=v
        if r<=a: return k
    return 'd'

# --- ground pass ---
grid=[['g' for _ in range(W)] for _ in range(H)]
for y in range(H):
    wt=ZONE[band_of(y)][2]
    for x in range(W):
        grid[y][x] = 'W' if (x==0 or x==W-1) else pick(wt)

# --- reserved cells that obstacles/spawns must never touch (a keep-open climb lane down the
# middle, plus pillars, spawn pocket, arrivals, portal). The lane guarantees a walkable
# path top-to-bottom no matter how the clumps fall. ---
reserved=set()
def reserve(x0,x1,y0,y1):
    for yy in range(max(0,y0),min(H,y1)):
        for xx in range(max(0,x0),min(W,x1)):
            reserved.add((xx,yy))

# pillars (bands 0,3,6,8) — clear a pocket, mark reserved
pillar_bands=[0,3,6,8]; pillars=[]
for b in pillar_bands:
    y=max(3,min(H-6, H-1-b*ZONE_H-8)); x=CX
    reserve(x-3,x+4,y-3,y+3)
    for yy in range(y-1,y+2):
        for xx in range(x-2,x+3):
            if 0<xx<W-1 and 0<=yy<H: grid[yy][xx]='d'
    pillars.append({'b':b,'name':ZONE[b][0],'tx':x,'ty':y})

# player spawn pocket
py=H-3; px=CX
reserve(px-4,px+5,H-7,H-1)
for yy in range(H-6,H-1):
    for xx in range(px-3,px+4):
        if 0<xx<W-1: grid[yy][xx]='d'

# HEARTH return portal
reserve(1,4,H-4,H-1)
grid[H-2][2]='T'

# --- OBSTACLE CLUMPS (trees / boulders) ---
# Instead of an independent per-tile roll (~6% obstacles, evenly sprinkled, no clearings),
# scatter a modest number of clump CENTRES and grow a ragged blob at each. This makes real
# boulder fields and tree stands with open ground between them, and roughly HALVES the
# obstacle count so there is far more room to move. A soft "keep-open" lane meanders down
# the map so there is always a wide dodging corridor.
def treeish(b):  # forests low, boulders high; a little overlap in the middle
    if b <= 1: return 't' if random.random()<0.85 else 'k'
    if b == 2: return 't' if random.random()<0.55 else 'k'
    if b == 3: return 't' if random.random()<0.20 else 'k'
    return 'k'

# a gentle sinuous open lane: for each row a centre x the clumps avoid (width ~9 tiles)
import math
lane=[CX + int(round(9*math.sin(y/34.0) + 4*math.sin(y/13.0))) for y in range(H)]
def in_lane(x,y):
    return abs(x - lane[y]) <= 4

# clump budget per band (fewer than the old per-tile scatter -> more space)
placed=0
for b in range(NZ):
    y0=H-(b+1)*ZONE_H; y1=H-b*ZONE_H
    # denser clumps in rocky/forest bands, sparse on the ember plains so they stay runnable
    nclumps = int(ZONE_H * 0.16)          # ~15 clumps per 96-row band
    for _ in range(nclumps):
        cx=random.randint(2,W-3); cy=random.randint(y0+1,y1-2)
        if in_lane(cx,cy): continue
        if (cx,cy) in reserved: continue
        rad=random.uniform(1.2,2.6)             # smaller, rounder blobs (no wide bars)
        # slight vertical bias so any elongation runs WITH the climb, never across it
        ry=rad*random.uniform(1.0,1.35); rx=rad
        typ=treeish(band_of(cy))
        rr=int(math.ceil(max(rx,ry)))
        for yy in range(cy-rr,cy+rr+1):
            for xx in range(cx-rr,cx+rr+1):
                if not (0<xx<W-1 and 0<=yy<H): continue
                if (xx,yy) in reserved or in_lane(xx,yy): continue
                if grid[yy][xx] in 'WTP': continue
                d=math.hypot((xx-cx)/rx,(yy-cy)/ry)   # elliptical, taller than wide
                edge=((xx*73+yy*151)%100)/100.0*0.7   # gentler ragged edge
                if d <= 0.75+edge:
                    if random.random()<0.66:
                        grid[yy][xx]=typ; placed+=1

# safety net: break any horizontal obstacle run longer than 4 tiles (a "row" the eye catches).
# Clumps almost never make these now, but overlapping ones can — punch gaps so nothing lines up.
for y in range(H):
    run=0
    for x in range(1,W-1):
        if grid[y][x] in 'tk':
            run+=1
            if run>4:                 # open a gap, restart the run
                grid[y][x]='d'; run=0
        else: run=0

# --- guarantee top<->bottom reachability on the CLOSED grid (BFS with t/k/W solid).
# If the clumps ever seal a row, punch the thinnest gap. ---
SOLID=set('tkW')
def walkable(x,y): return 0<=x<W and 0<=y<H and grid[y][x] not in SOLID
def connected():
    # BFS from the spawn pocket; must reach the top row's interior
    seen=[[False]*W for _ in range(H)]
    q=deque([(px,py)]); seen[py][px]=True; topreach=False
    while q:
        x,y=q.popleft()
        if y<=1: topreach=True
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx,ny=x+dx,y+dy
            if 0<=nx<W and 0<=ny<H and not seen[ny][nx] and walkable(nx,ny):
                seen[ny][nx]=True; q.append((nx,ny))
    return topreach, seen
ok,seen=connected()
tries=0
while not ok and tries<200:
    tries+=1
    # clear obstacles along the lane for the highest unreached band, reopening the corridor
    for y in range(H):
        if not any(seen[y]):
            for xx in range(lane[y]-4,lane[y]+5):
                if 0<xx<W-1 and grid[y][xx] in 'tk': grid[y][xx]='d'
            break
    ok,seen=connected()

# --- SPAWNS: ORIGINAL density (the user wants harder ENEMIES, not MORE of them — difficulty
# comes from stats + behaviour, tuned in 03_entities/07_update, not from count). ---
for y in range(H):
    b=band_of(y)
    dens=(0.010+0.006*b)*0.62
    sratio=0.25+0.05*b
    for x in range(1,W-1):
        if grid[y][x] in 'tkWTP': continue
        if (x,y) in reserved: continue
        if random.random()<dens:
            grid[y][x]='s' if random.random()<sratio else 'c'

# arrivals across the bottom two zones
arrivals=[]
for _ in range(24):
    ax=random.randint(3,W-4); ay=random.randint(H-ZONE_H, H-4)
    arrivals.append([ax,ay])

grid[py][px]='P'
rows=[''.join(r) for r in grid]
names=[{'n':ZONE[i][0],'lv':ZONE[i][1],'lv2':(ZONE[i+1][1] if i+1<len(ZONE) else 160)} for i in range(len(ZONE))]
grove={'big':True,'w':W,'h':H,'vgrid':True,'name':'The Ascent',
       'rings':{'vertical':True,'names':names},
       'arrivals':arrivals,'pillars':pillars,'map':rows}

js ="// AUTO-GENERATED vertical EmberGrove map (genmap2.py). Overwrites ROOM_DEFS['G'].\n"
js+="ROOM_DEFS['G']="+json.dumps(grove)+";\n"
out=r"C:\Users\darkc\Desktop\EmberRealm\emberrealm-src\00d_vgrove.js"
open(out,"w",encoding="utf-8").write(js)

from collections import Counter
cnt=Counter(''.join(rows)); tot=sum(cnt.values())
obst=cnt['t']+cnt['k']; spawns=cnt['s']+cnt['c']
print("wrote",out)
print("reachable top<->bottom:", ok, "(lane punches:",tries,")")
print("obstacles: %d  (%.1f%%  was ~6.0%%)" % (obst, 100*obst/tot))
print("  trees %d  boulders %d" % (cnt['t'],cnt['k']))
print("spawns: %d  (%.1f%%  was ~1.9%%)" % (spawns, 100*spawns/tot))
print("chars:",dict(cnt))
