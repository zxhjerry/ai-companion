"""
Art Engine - Phase 4: Visual Arts Prompt Generator
Attribute-driven 4K character art prompt system
"""

import json
import random
from typing import Dict, List, Optional
from enum import Enum

# ===== 审美元素配置 =====


class ArtStyle(Enum):
    """Art style presets"""
    ANIME = "anime"
    PHOTOREALISTIC = "photorealistic"
    STYLIZED = "stylized"
    PAINTING = "painting"
    CYBERPUNK = "cyberpunk"
    VAPORWAVE = "vaporwave"


class BodyType(Enum):
    """Character body types"""
    FIT = "fit"
    ATHLETIC = "athletic"
    LEAN = "lean"
    MUSCULAR = "muscular"
    SLIM = "slim"


class HairColor(Enum):
    """Hair color options"""
    BLACK = "black"
    BROWN = "brown"
    BLONDE = "blonde"
    RED = "red"
    BLUE = "blue"
    PURPLE = "purple"
    PINK = "pink"
    WHITE = "white"


class EyeColor(Enum):
    """Eye color options"""
    BROWN = "brown"
    BLUE = "blue"
    GREEN = "green"
    HAZEL = "hazel"
    AMBER = "amber"
    VIOLET = "violet"


class ClothingStyle(Enum):
    """Clothing style options"""
    CASUAL = "casual"
    FORMAL = "formal"
    MILITARY = "military"
    FANTASY = "fantasy"
    SCI_FI = "sci-fi"
    UNIFORM = "uniform"


# ===== Prompt 模板 =====

QUALITY_MODIFIERS = [
    "4K ultra high definition",
    "highly detailed",
    "sharp focus",
    "professional illustration",
    "award-winning digital art",
    "masterpiece",
    "amazing quality",
    "stunning visuals"
]

ATMOSPHERE_MODIFIERS = [
    "warm golden hour lighting",
    "soft ambient light",
    "dramatic shadows",
    "neon-lit background",
    "cinematic atmosphere",
    "magical glowing ambiance",
    "vaporwave aesthetic",
    "cyberpunk environment"
]

CAMERA_ANGLES = [
    "full body portrait",
    "three-quarter shot",
    "close-up portrait",
    "medium shot",
    "dynamic angle"
]

POSES = [
    "standing confidently",
    "sitting elegantly",
    "walking gracefully",
    "ready for action",
    "relaxed pose",
    "leaning against wall",
    "looking at viewer"
]


# ===== 核心功能 =====


class AttributeDrivenArtEngine:
    """Attribute-driven art prompt generator for AI Companion 2.1"""

    def __init__(self):
        self.style_config = {
            'anime': {
                'name': 'anime style',
                'quality_boosts': ['anime style', 'manga influence', 'cel shading', 'smooth colors']
            },
            'photorealistic': {
                'name': 'photorealistic',
                'quality_boosts': ['photorealistic', 'hyper-realistic', 'detailed skin texture', 'subsurface scattering']
            },
            'vaporwave': {
                'name': 'vaporwave aesthetic',
                'quality_boosts': ['vaporwave', 'retro futurism', 'neon pink and cyan', '80s aesthetic', 'glitch effect']
            }
        }

    def generate_prompt(
        self,
        name: str,
        gender: str,
        appearance: int,  # APP 颜值 (显性)
        luck: int,  # LCK 幸运 (隐藏，不直接影响 Prompt)
        personality: Dict[str, any],
        appearance_config: Optional[Dict] = None
    ) -> Dict:
        """
        生成美术 Prompt（基于 APP 颜值 + 外观配置）

        Args:
            name: 角色名称
            gender: 性别
            appearance: 颜值 1-100（显性，影响 Prompt 质量）
            luck: 幸运 1-100（隐藏，不影响 Prompt）
            personality: 角色性格
            appearance_config: 外观配置（hair, eyes, style）

        Returns:
            生成的 Prompt 和配置信息
        """
        # 1. 基础外观元素
        hair = appearance_config.get('hair', 'short brown') if appearance_config else 'short brown'
        eyes = appearance_config.get('eyes', 'brown') if appearance_config else 'brown'
        style = appearance_config.get('style', 'casual') if appearance_config else 'casual'

        # 2. 根据颜值决定艺术风格
        if appearance >= 85:
            art_style = 'photorealistic'
            quality_level = 'ultra-high'
        elif appearance >= 70:
            art_style = 'anime'
            quality_level = 'high'
        else:
            art_style = 'vaporwave'
            quality_level = 'standard'

        # 3. 根据性别 + 外观生成角色描述
        gender_pronoun = 'beautiful' if gender == 'female' else 'handsome' if gender == 'male' else 'androgynous'

        appearance_desc = self._generate_appearance_description(
            gender, hair, eyes, style, appearance
        )

        # 4. 根据性格添加氛围元素
        atmosphere = self._generate_atmosphere(personality)

        # 5. 选择相机角度和姿势
        camera_angle = random.choice(CAMERA_ANGLES)
        pose = random.choice(POSES)

        # 6. 组合 Prompt (按 APP 颜值确定质量)
        quality_modifiers = self._select_quality_modifiers(appearance)
        full_prompt = self._assemble_prompt(
            gender_pronoun,
            appearance_desc,
            camera_angle,
            pose,
            atmosphere,
            quality_modifiers,
            art_style
        )

        return {
            'prompt': full_prompt,
            'style': art_style,
            'quality_level': quality_level,
            'appearance_score': appearance,
            'gender': gender,
            'name': name,
            'metadata': {
                'hair': hair,
                'eyes': eyes,
                'style': style,
                'camera_angle': camera_angle,
                'pose': pose,
                'atmosphere': atmosphere
            }
        }

    def _generate_appearance_description(
        self,
        gender: str,
        hair: str,
        eyes: str,
        style: str,
        appearance: int
    ) -> str:
        """生成外观描述"""

        # 基础描述
        desc = f"a {gender} with {hair} hair and {eyes} eyes"

        # APP 修饰
        if appearance >= 85:
            desc += ", elegant and sophisticated appearance, radiant beauty"
        elif appearance >= 70:
            desc += ", attractive features, well-proportioned body"
        elif appearance >= 50:
            desc += ", pleasant appearance"
        else:
            desc += ", simple appearance"

        # 服装风格
        desc += f", wearing {style} attire"

        return desc

    def _generate_atmosphere(self, personality: Dict) -> str:
        """根据性格生成氛围"""
        traits = personality.get('traits', [])

        # 性格关键词映射到氛围
        mood_mapping = {
            'warm': ['warm', 'friendly', 'soft light'],
            'curious': ['thoughtful', 'inquisitive', 'subtle mystery'],
            'playful': ['bright', 'energetic', 'vibrant colors'],
            'elegant': ['sophisticated', 'minimalist', 'clean aesthetic'],
            'dark': ['mysterious', 'shadowed', 'dramatic lighting'],
            'adventurous': ['dynamic composition', 'action-ready pose', 'vibrant']
        }

        # 选择最佳匹配的氛围
        selected_atmospheres = []
        for trait in traits:
            if trait in mood_mapping:
                selected_atmospheres.extend(mood_mapping[trait])

        if not selected_atmospheres:
            selected_atmospheres = ['natural', 'balanced']

        return ', '.join(selected_atmospheres[:3])

    def _select_quality_modifiers(self, appearance: int) -> List[str]:
        """选择质量修饰词（APP 驱动）"""

        if appearance >= 95:
            return [
                "8K resolution",
                "masterpiece quality",
                "ultra-detailed",
                "photorealistic rendering",
                "perfect proportion",
                "professional digital art"
            ]
        elif appearance >= 85:
            return [
                "4K resolution",
                "highly detailed",
                "sharp focus",
                "professional illustration"
            ]
        elif appearance >= 70:
            return [
                "4K resolution",
                "detailed",
                "good quality",
                "clear focus"
            ]
        else:
            return [
                "clear details",
                "decent quality"
            ]

    def _assemble_prompt(
        self,
        gender_pronoun: str,
        appearance_desc: str,
        camera_angle: str,
        pose: str,
        atmosphere: str,
        quality_modifiers: List[str],
        art_style: str
    ) -> str:
        """组合完整 Prompt"""

        # 基础部分
        prompt = f"{gender_pronoun} {appearance_desc}"

        # 添加动作和拍照角度
        prompt += f", {pose}, {camera_angle}"

        # 添加氛围
        if atmosphere:
            prompt += f", {atmosphere}"

        # 添加质量修饰词
        if quality_modifiers:
            prompt += ", " + ", ".join(quality_modifiers)

        # 添加艺术风格
        if art_style:
            prompt += f", {self.style_config[art_style]['name']}"

        return prompt

    def generate_multiple_prompts(
        self,
        name: str,
        gender: str,
        appearance: int,
        luck: int,
        personality: Dict,
        count: int = 5
    ) -> List[Dict]:
        """生成多个 Prompt（随机组合不同元素）"""

        prompts = []

        for i in range(count):
            prompt = self.generate_prompt(
                name, gender, appearance, luck, personality
            )

            # 添加随机变化
            for j in range(i):
                # 随机交换相机角度
                prompt['metadata']['camera_angle'] = random.choice(CAMERA_ANGLES)
                # 随机交换姿势
                prompt['metadata']['pose'] = random.choice(POSES)

            prompts.append(prompt)

        return prompts

    def export_prompts_to_json(self, prompts: List[Dict], output_file: str):
        """导出 Prompt 到 JSON 文件"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(prompts, f, indent=2, ensure_ascii=False)

    def test_prompt_generation(self):
        """测试 Prompt 生成功能"""
        print("\n" + "=" * 60)
        print("🎨 美术 Prompt 引擎测试")
        print("=" * 60 + "\n")

        engine = AttributeDrivenArtEngine()

        # 测试用例 1: 高颜值女性角色
        print("📋 测试用例 1: 高颜值女性角色")
        prompt1 = engine.generate_prompt(
            name='Luna',
            gender='female',
            appearance=95,
            luck=90,
            personality={'traits': ['warm', 'curious', 'playful']},
            appearance_config={
                'hair': 'long wavy silver',
                'eyes': 'deep blue',
                'style': 'casual elegant'
            }
        )

        print(f"\n📝 Prompt:\n{prompt1['prompt']}\n")
        print(f"🎯 风格: {prompt1['style']} | 质量: {prompt1['quality_level']}")
        print(f"⭐ 颜值: {prompt1['appearance_score']}\n")

        # 测试用例 2: 中等颜值男性角色
        print("📋 测试用例 2: 中等颜值男性角色")
        prompt2 = engine.generate_prompt(
            name='Max',
            gender='male',
            appearance=70,
            luck=50,
            personality={'traits': ['adventurous', 'daring', 'humorous']},
            appearance_config={
                'hair': 'short brown',
                'eyes': 'warm brown',
                'style': 'practical explorer'
            }
        )

        print(f"\n📝 Prompt:\n{prompt2['prompt']}\n")
        print(f"🎯 风格: {prompt2['style']} | 质量: {prompt2['quality_level']}")
        print(f"⭐ 颜值: {prompt2['appearance_score']}\n")

        # 测试用例 3: 低颜值角色
        print("📋 测试用例 3: 低颜值角色")
        prompt3 = engine.generate_prompt(
            name='Test',
            gender='other',
            appearance=40,
            luck=40,
            personality={'traits': ['dark', 'serious']},
            appearance_config={
                'hair': 'black',
                'eyes': 'black',
                'style': 'casual'
            }
        )

        print(f"\n📝 Prompt:\n{prompt3['prompt']}\n")
        print(f"🎯 风格: {prompt3['style']} | 质量: {prompt3['quality_level']}")
        print(f"⭐ 颜值: {prompt3['appearance_score']}\n")

        # 测试用例 4: 生成多个 Prompt
        print("📋 测试用例 4: 生成多个 Prompt (5 个随机变体)")
        multiple_prompts = engine.generate_multiple_prompts(
            name='Variations',
            gender='female',
            appearance=85,
            luck=80,
            personality={'traits': ['elegant', 'sophisticated']},
            count=5
        )

        for i, p in enumerate(multiple_prompts, 1):
            print(f"\n📝 Prompt {i}:\n{p['prompt']}")

        # 导出 Prompt
        output_file = '/home/node/.openclaw1/projects/ai-companion/art_prompts.json'
        engine.export_prompts_to_json(multiple_prompts, output_file)
        print(f"\n✅ Prompt 已导出到: {output_file}")

        print("\n" + "=" * 60)
        print("✅ 美术 Prompt 引擎测试完成")
        print("=" * 60 + "\n")

        return True


# ===== 测试脚本 =====

if __name__ == '__main__':
    engine = AttributeDrivenArtEngine()
    success = engine.test_prompt_generation()
    import sys
    sys.exit(0 if success else 1)
