"""可复现 λ 线路图标，无外部字体。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'app/src/main/res'
SOURCE = ROOT / 'icon-source'
def foreground():
    image = Image.new('RGBA', (1024, 1024))
    draw = ImageDraw.Draw(image)
    draw.line([(388,290),(447,332),(635,684)], fill='#64d8bd', width=46)
    draw.line([(478,388),(350,684)], fill='#64d8bd', width=46)
    draw.line([(317,736),(707,736)], fill='#eabe75', width=18)
    draw.line([(376,720),(376,776)], fill='#eabe75', width=18)
    draw.line([(648,720),(648,776)], fill='#eabe75', width=18)
    glow = image.filter(ImageFilter.GaussianBlur(12))
    glow.putalpha(glow.getchannel('A').point(lambda value: round(value * .3)))
    return Image.alpha_composite(glow, image)
def main():
    SOURCE.mkdir(parents=True, exist_ok=True)
    fore = foreground()
    full = Image.alpha_composite(Image.new('RGBA', (1024,1024), '#131c2d'), fore)
    full.save(SOURCE / 'icon-full.png'); fore.save(SOURCE / 'icon-foreground.png')
    full.resize((512,512), Image.Resampling.LANCZOS).save(SOURCE / 'store-icon-512.png')
    for density,legacy,adaptive in [('mdpi',48,108),('hdpi',72,162),('xhdpi',96,216),('xxhdpi',144,324),('xxxhdpi',192,432)]:
        folder = RES / ('mipmap-' + density); folder.mkdir(parents=True, exist_ok=True)
        full.resize((legacy,legacy), Image.Resampling.LANCZOS).save(folder / 'ic_launcher.png')
        fore.resize((adaptive,adaptive), Image.Resampling.LANCZOS).save(folder / 'ic_launcher_foreground.png')
    print('Generated all Lambda icon densities and original artwork.')
if __name__ == '__main__': main()
