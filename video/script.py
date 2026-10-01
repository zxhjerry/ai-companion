"""Director's script: narration lines, pacing and scene cues.

Each line is one breath group, synthesised in one pass so prosody stays
natural. Fields:
  scene  - visual scene key (see visual/scenes.js)
  text   - on-screen text (original copy, with obvious typos fixed)
  say    - spoken form when it differs from text (numbers -> hanzi)
  speed  - Kokoro speed factor (1.0 = model default, ~3.7 chars/s)
  pause  - silence after the line, seconds (the edit's breathing room)
  music  - music cue that starts at this line (see audio/score.py)
"""

VOICE_SID = 5  # Kokoro v1.1-zh speaker zf_003
SPEED_SCALE = 1.12  # global pace trim on top of per-line speed

N = 1.10   # normal narration pace
S = 1.00   # reflective / emphasis
F = 1.18   # the noisy, fast world

LINES = [
    # ---------------------------------------------------------------- cold open
    dict(scene='title', text='千锤百炼之后，', speed=0.92, pause=0.55, music='open'),
    dict(scene='title', text='最难，', speed=0.9, pause=0.45),
    dict(scene='title', text='是被看见。', speed=0.9, pause=1.6),
    dict(scene='regret', text='我们都在经历同一种遗憾：', speed=S, pause=0.7),
    dict(scene='quiet', text='真正的好东西，太安静了。', speed=0.95, pause=0.6),
    dict(scene='loud', text='喧嚣的烂东西，太会造势了。', speed=1.05, pause=1.5, music='loud'),

    # ------------------------------------------------------- 01 the livestream
    dict(scene='night', text='偶然在一个晚上，已是深夜12点过，', say='偶然在一个晚上，已是深夜十二点过，', speed=N, pause=0.2, music='night'),
    dict(scene='night', text='我在一个竹笛直播间停了下来。', speed=N, pause=0.6),
    dict(scene='stream', text='画面里的老师傅声音沙哑，带着几分激动与无奈，正认真地调试笛子。', speed=N, pause=0.5),
    dict(scene='quote', text='他说：', speed=S, pause=0.45),
    dict(scene='quote', text='“今天喝了点酒，每天坐在这里调笛子，', speed=1.0, pause=0.25),
    dict(scene='quote', text='但是你们却不懂我这每一刀一刻的价值。”', speed=0.95, pause=1.1),
    dict(scene='stay', text='因为这句话，我在直播间停留了许久，', speed=N, pause=0.2),
    dict(scene='stay', text='发现他其实是一位真正的手艺人和艺术者，', speed=N, pause=0.25),
    dict(scene='stay', text='看着屏幕里深耕半生的制笛手艺人，忽然心生无尽感慨。', speed=1.02, pause=0.9, music='craft'),
    dict(scene='craft3', text='他守着数年阴干的老竹、手工打磨的内径、逐支精调的音色，', speed=1.02, pause=0.25),
    dict(scene='devotion', text='以最笨拙、最虔诚的态度，对待手里的每一支竹笛。', speed=S, pause=0.6),
    dict(scene='nolist', text='没有花哨话术，没有秒杀套路，没有捆绑速成教学，', speed=N, pause=0.2),
    dict(scene='nolist', text='甚至连竹笛的外观都最朴素，没有任何装饰，', speed=N, pause=0.2),
    dict(scene='nolist', text='只安静吹笛、踏实制器。', speed=0.95, pause=1.0),
    dict(scene='cruel', text='可现实格外残酷：', speed=S, pause=0.8, music='cruel'),
    dict(scene='empty', text='这份浸着岁月沉淀、经得起反复细品的真功夫，', speed=N, pause=0.2),
    dict(scene='empty', text='直播间里驻足停留的人，却不多。', speed=1.0, pause=0.7),
    dict(scene='flood', text='反观满屏流水线产出的玩具笛、虚标竹材的噱头笛，', speed=F, pause=0.15, music='traffic'),
    dict(scene='flood', text='靠着紧凑的营销话术、低价刺激与限时套路，订单却源源不断。', speed=F, pause=1.0),
    dict(scene='mismatch', text='那一刻我忽然看懂，这从来不是手艺的落败，', speed=1.0, pause=0.3, music='realize'),
    dict(scene='mismatch', text='是慢打磨与快流量的时代错位。', speed=0.95, pause=1.1),
    dict(scene='wonder', text='那晚我一直在想：', speed=S, pause=0.5),
    dict(scene='wonder', text='要怎样把我听见的好，让其他人也听见？', speed=0.95, pause=2.0),

    # ------------------------------------------------------ 02 two race tracks
    dict(scene='tracks', text='当我看着竹笛圈这种割裂，想到了我身处多年的游戏美术外包行业。', speed=N, pause=0.4, music='tracks'),
    dict(scene='tracks', text='两个完全不同的赛道，却有着一模一样的时代悲哀。', speed=1.02, pause=0.6),
    dict(scene='twin_flute', text='竹笛手艺人，用几年阴干老竹、手工反复修孔、逐根调音，追求一丝音色的纯粹；', speed=N, pause=0.35),
    dict(scene='twin_art', text='美术创作者，用无数个深夜手绘笔触、反复推敲光影、磨几十版构图细节，', speed=N, pause=0.2),
    dict(scene='twin_art', text='追求一帧画面的氛围，力求完美。', speed=1.02, pause=0.6),
    dict(scene='four', text='真正沉下心做东西，本质都是一样的：', speed=1.02, pause=0.35),
    dict(scene='four', text='耗时间、耐寂寞、慢打磨、不讨巧。', speed=0.9, pause=0.8),
    dict(scene='noreward', text='可如今的市场，早已不再奖励“慢慢做好一件事”。', speed=1.0, pause=0.8, music='market'),
    dict(scene='market_flute', text='竹笛市场：精心调试的手工笛无人问津，', speed=N, pause=0.2),
    dict(scene='market_flute', text='流水线速成、材质掺假、音准模糊的玩具笛，靠着低价和套路占领市场。', speed=1.14, pause=0.5),
    dict(scene='market_art', text='游戏美术行业：一笔一笔手绘的质感原画、层层渲染的光影场景、反复打磨的细节氛围，', speed=N, pause=0.2),
    dict(scene='market_art', text='甲方嫌慢、市场嫌贵。', speed=1.0, pause=0.45),
    dict(scene='aigrid', text='取而代之的，是模板量产、AI速成、低价流水线套图。', speed=1.12, pause=1.0),
    dict(scene='irony', text='这个时代最讽刺的共性就是：', speed=S, pause=0.8, music='irony'),
    dict(scene='irony', text='敷衍的速成品，在收割流量；', speed=1.0, pause=0.5),
    dict(scene='irony', text='沉淀的用心作，在默默吃亏。', speed=0.92, pause=1.5),

    # -------------------------------------------------------- 03 twenty years
    dict(scene='painter', text='我身边有位四十多岁的画师，', speed=N, pause=0.2, music='painter'),
    dict(scene='painter', text='放在从前，二十年的手绘功底、日积月累的审美沉淀，', speed=N, pause=0.2),
    dict(scene='painter', text='是他安身立命最大的资本、最硬的底气。', speed=1.02, pause=0.6),
    dict(scene='aicome', text='可AI时代骤然来临，市场彻底变了。', speed=1.0, pause=0.6),
    dict(scene='swap', text='行业不再需要细腻的笔触、耐心的打磨、层层递进的光影塑造，', speed=N, pause=0.2),
    dict(scene='swap', text='只需要快速的产能、批量的出图、无限的迭代。', speed=1.14, pause=0.7),
    dict(scene='misfit', text='二十年的积累，在追求速度的洪流里，突然变得格格不入。', speed=1.02, pause=0.6),
    dict(scene='rules', text='坚守的手艺没有退步，只是时代的赛道，已经悄悄换了规则。', speed=1.0, pause=1.2),
    dict(scene='me', text='这份感受，我格外能共情。', speed=S, pause=0.4, music='me'),
    dict(scene='me', text='我自己也是游戏美术外包的老人，白发时刻提醒我竞争的惨烈，', speed=N, pause=0.2),
    dict(scene='me_run', text='每天总有一股力量推着我不停向前，不敢停下。', speed=1.06, pause=0.5),
    dict(scene='anxiety', text='我也曾深深焦虑，', speed=S, pause=0.25),
    dict(scene='anxiety', text='虽然三年前就已开始在工作中使用AI，', speed=N, pause=0.15),
    dict(scene='anxiety', text='但正因为了解，所以更怕AI会慢慢取代我的价值，', speed=1.02, pause=0.2),
    dict(scene='anxiety', text='在迷茫里挣扎了很久。', speed=0.95, pause=1.3),

    # --------------------------------------------------------- 04 new worlds
    dict(scene='march', text='今年三月开始，我试着跳出熟悉的单纯美术领域，去创作行业之外的内容，', speed=N, pause=0.2, music='march'),
    dict(scene='march', text='音乐、学习竹笛、搭建自媒体账号等等，', speed=1.05, pause=0.2),
    dict(scene='march', text='主动去触碰我原本世界之外的更多世界。', speed=1.02, pause=0.5),
    dict(scene='boss', text='我的老板，也在同时疯狂熬夜，', speed=N, pause=0.15),
    dict(scene='boss', text='深度使用AI、运营、培训、公司OA、研发游戏、文旅项目等等。', speed=1.12, pause=0.45),
    dict(scene='wave', text='一开始我并不理解他为什么同时铺开这么多方向，', speed=N, pause=0.15),
    dict(scene='wave', text='只是隐约觉得时代浪潮来了，总要试着做点什么。', speed=1.05, pause=0.7),
    dict(scene='path', text='慢慢走下去才想通透：', speed=S, pause=0.35),
    dict(scene='path', text='不是我失去了价值，而是已身处新的时代，', speed=1.02, pause=0.2),
    dict(scene='path', text='我需要去创造属于自己的、全新的价值。', speed=1.0, pause=0.7),
    dict(scene='connect', text='所有这些看似分散的尝试，底层逻辑都是贯通的。', speed=N, pause=0.4),
    dict(scene='connect', text='我们最终走向同一条路：学会把“更好的自己”展现出来，', speed=1.04, pause=0.2),
    dict(scene='connect', text='于个人如是，于公司亦如是。', speed=1.0, pause=0.5),
    dict(scene='core', text='而在这个新时代，如何让别人看见真实、有价值的自己，才是最核心的命题。', speed=1.02, pause=1.3),

    # ------------------------------------------------------------- 05 roots
    dict(scene='books', text='那天老板在办公室，开箱了厚厚一摞画册。', speed=N, pause=0.4, music='books'),
    dict(scene='books', text='册子里尽是流传百年的艺术流派、经典画风、传统美术与历史美学……', speed=1.04, pause=0.5),
    dict(scene='books', text='我问他为什么突然买这么多。', speed=N, pause=0.3),
    dict(scene='books', text='他说：', speed=S, pause=0.7),
    dict(scene='roots', text='未来，唯有扎根本源、独一无二的事物，才有生命力。', speed=0.88, pause=1.4, music='roots'),
    dict(scene='copy', text='是的，AI可以复制技法、量产画面、拼接风格、堆砌效果，', speed=1.08, pause=0.4, music='copy'),
    dict(scene='cannot', text='但它复制不了数十年沉淀的审美底蕴，', speed=1.0, pause=0.25),
    dict(scene='cannot', text='复制不了根植传统的文化内核，', speed=1.0, pause=0.25),
    dict(scene='cannot', text='复制不了手艺人耐住寂寞、一锤一磨、一笔一画的温度与执念。', speed=0.98, pause=1.2),
    dict(scene='merge', text='这一刻我彻底通透：', speed=S, pause=0.4, music='merge'),
    dict(scene='merge', text='民乐竹笛、游戏美术，看似毫不相干的两个赛道，命运和内核，高度相通。', speed=1.04, pause=0.6),
    dict(scene='root_flute', text='竹笛的根，是经年风干的老竹、代代相传的制笛工艺、沉淀千年的国风音律以及文化传承；', speed=1.06, pause=0.35),
    dict(scene='root_art', text='美术的根，是传统美学、历史沉淀、艺术底蕴、手绘温度、独一无二的创作感知。', speed=1.06, pause=0.5),
    dict(scene='unique_flute', text='流水线可以批量生产笛子，却做不出每一根老竹的肌理与独有的音色；', speed=1.05, pause=0.3),
    dict(scene='unique_art', text='AI可以批量生成画面，却造不出带着审美积淀、情绪温度、文化内核的作品。', speed=1.05, pause=0.6),
    dict(scene='rare', text='越是速成泛滥的时代，“沉淀、根基、独一无二、有温度”，反而越稀缺、越珍贵。', speed=0.98, pause=1.2),

    # ------------------------------------------------------------ 06 seen
    dict(scene='youth', text='未来，无论是民乐，还是美术，涌入的年轻人会越来越多。', speed=N, pause=0.3, music='youth'),
    dict(scene='youth', text='大家带着纯粹的热爱奔赴而来，最后却一次次被劣币环境劝退。', speed=1.04, pause=0.6),
    dict(scene='beginner_flute', text='想学笛的人，第一步买到的是音色浑浊的工业玩具，误以为是自己没有天赋；', speed=1.06, pause=0.3),
    dict(scene='beginner_art', text='想学画画的人，第一眼接触的是模板快餐作品，误以为创作本来就没有温度。', speed=1.06, pause=0.7),
    dict(scene='masters', text='制笛师傅不会营销，只会埋头把竹材养好、把音修准；', speed=N, pause=0.25),
    dict(scene='masters', text='资深美术不会套路，只会死磕结构、光影、氛围细节。', speed=N, pause=0.6),
    dict(scene='timbre', text='竹笛的音色，需要岁月阴干、手工精修，才能吹出古风里的苍凉与温柔；', speed=0.98, pause=0.35, music='timbre'),
    dict(scene='canvas', text='美术的画面，需要笔触堆叠、光影沉淀，才能撑起故事里的氛围与意境。', speed=0.98, pause=0.6),
    dict(scene='heal', text='所有能治愈人的、能打动人的、能传世的审美，永远无法速成。', speed=0.95, pause=1.0),
    dict(scene='product', text='流水线上出的，永远只是商品。', speed=0.95, pause=0.6, music='climax'),
    dict(scene='work', text='唯有时间与真心打磨出的，才是作品。', speed=0.9, pause=1.0),
    dict(scene='quietones', text='在这个人人追逐效率、偏爱速成的时代，', speed=1.0, pause=0.3),
    dict(scene='quietones', text='踏实做事的人，始终沉默、始终珍贵。', speed=0.92, pause=2.2),
    dict(scene='finale', text='只是，', speed=0.85, pause=1.3, music='finale'),
    dict(scene='finale', text='我们可能一辈子都在专注“做好作品”，', speed=0.95, pause=0.5),
    dict(scene='finale2', text='但从此刻起，必须学会这个流量时代的“如何被看见”。', speed=0.9, pause=4.5),
]
