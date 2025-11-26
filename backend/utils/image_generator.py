import os
import json
import random
import math
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime

class ImageGenerator:
    def __init__(self, resource_dir):
        self.resource_dir = resource_dir
        self.header_path = os.path.join(resource_dir, 'header.jpg')
        self.idioms_path = os.path.join(resource_dir, 'idioms100.json')
        self.idioms_list = self._load_idioms()

    def _load_idioms(self):
        try:
            with open(self.idioms_path, 'r', encoding='utf-8') as f:
                idioms_json = json.load(f)
                if isinstance(idioms_json, dict) and '三国成语大全' in idioms_json:
                    return idioms_json['三国成语大全']
                return idioms_json if isinstance(idioms_json, list) else []
        except Exception:
            return []

    def _load_font(self, size):
        # Try to load some common Chinese fonts
        # On Linux server, you might need to install fonts-wqy-zenhei or similar
        # and point to the correct path, e.g., /usr/share/fonts/...
        font_names = [
            "msyh.ttc", "msyh.ttf", "simhei.ttf", 
            "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
            "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf"
        ]
        for font_name in font_names:
            try:
                return ImageFont.truetype(font_name, size)
            except Exception:
                continue
        return ImageFont.load_default()

    def _measure_height(self, font, text):
        try:
            bbox = font.getbbox(text)
            return float(bbox[3] - bbox[1])
        except Exception:
            return float(font.size if hasattr(font, 'size') else 10)

    def _wrap_text(self, text, font, max_width):
        lines = []
        current = ''
        for ch in text:
            candidate = current + ch
            try:
                bbox = font.getbbox(candidate)
                width = bbox[2] - bbox[0]
            except Exception:
                width = len(candidate) * (font.size if hasattr(font, 'size') else 10)
            
            if current and width > max_width:
                lines.append(current)
                current = ch
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines

    def _format_shichen(self, time_str):
        try:
            # time_str: YYYY-MM-DD HH:MM
            dt = datetime.strptime(time_str, '%Y-%m-%d %H:%M')
            hour = dt.hour
            shichens = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
            index = (hour + 1) // 2 % 12
            return f"{dt.strftime('%Y年%m月%d日')} {shichens[index]}时"
        except:
            return time_str

    def generate_comparison_images(self, results, early_ts, late_ts, metric_label, output_dir, metric_key='battle'):
        print(f"Starting image generation for {len(results)} items...")
        os.makedirs(output_dir, exist_ok=True)
        
        # Prepare data
        # results is list of {name, group, diff, early_val, late_val}
        
        # Group data
        groups = {}
        all_items = []
        for item in results:
            g = item.get('group', '未分组')
            groups.setdefault(g, []).append(item)
            all_items.append(item)
            
        # Sort groups
        sorted_group_names = sorted(groups.keys(), key=lambda x: (x == '未分组', x))
        
        # Prepare render list: (group_name, items)
        render_list = [('全盟', all_items)]
        for g in sorted_group_names:
            if g != '未分组':
                render_list.append((g, groups[g]))
        
        # Load header image
        TARGET_WIDTH = 1170 # iPhone standard width
        
        try:
            header_img = Image.open(self.header_path).convert('RGBA')
        except Exception:
            # Fallback if header missing
            header_img = Image.new('RGBA', (800, 200), (200, 200, 200))
            
        # Resize header to target width
        if header_img.width != TARGET_WIDTH:
            ratio = TARGET_WIDTH / header_img.width
            new_height = int(header_img.height * ratio)
            # Use LANCZOS for high quality downsampling/upsampling
            resample_method = getattr(Image, 'Resampling', Image).LANCZOS
            header_img = header_img.resize((TARGET_WIDTH, new_height), resample_method)
            
        header_w, header_h = header_img.size
        
        # Background color (Light Yellow)
        BG_COLOR = (255, 255, 224, 255) # #FFFFE0

        def ensure_canvas(min_height):
            # Create new canvas with background color
            total_height = int(max(header_h, min_height))
            canvas = Image.new('RGBA', (header_w, total_height), BG_COLOR)
            
            # Paste header at top
            canvas.paste(header_img, (0, 0))
            
            return canvas

        # Fonts - Scaled for 1170px width
        table_font = self._load_font(48) # Table Content
        idiom_body_font = self._load_font(36) # Idiom Body
        idiom_title_font = self._load_font(42) # Idiom Title

        table_line_height = max(int(self._measure_height(table_font, '汉')), 36)
        row_height_base = table_line_height + 32 # Increased padding
        idiom_body_height = max(int(self._measure_height(idiom_body_font, '汉')), 36)

        HEADER_BOTTOM_GAP = 60
        GROUP_TITLE_GAP = 32
        TABLE_BOTTOM_PADDING = 0
        IDIOM_TOP_PADDING = 80
        IDIOM_BOTTOM_PADDING = 100
        IDIOM_LINE_SPACING = 20
        TABLE_WIDTH_RATIO = 0.92 # Slightly wider table
        
        # Format times
        early_ts_fmt = self._format_shichen(early_ts)
        late_ts_fmt = self._format_shichen(late_ts)
        time_range_text = f"{early_ts_fmt} → {late_ts_fmt}"
        
        saved_paths = []
        
        for group_name, items in render_list:
            print(f"Generating image for group: {group_name} with {len(items)} items")
            if not items:
                continue
                
            # Sort items by diff desc
            items.sort(key=lambda x: x['diff'], reverse=True)
            
            group_label = group_name if group_name == '全盟' else f"{group_name} 组"
            table_rows = len(items)
            table_height = (table_rows + 1) * row_height_base + TABLE_BOTTOM_PADDING

            # Idiom
            idiom_title_text = ''
            idiom_story_lines = []
            if self.idioms_list:
                idiom_entry = random.choice(self.idioms_list)
                if isinstance(idiom_entry, dict) and '成语' in idiom_entry and '典故' in idiom_entry:
                    idiom_title_text = f"{idiom_entry['成语']}"
                    idiom_story_lines = self._wrap_text(str(idiom_entry['典故']), idiom_body_font, header_w - 100) # Wider text area

            # Calculate Layout
            title1_y = header_h + HEADER_BOTTOM_GAP
            # Combined title: Group Name | Time -> Time
            title1_text = f"{group_label} 丨 {time_range_text}"
            # Use a slightly smaller font for the combined line to fit
            combined_font = self._load_font(38) 
            title1_h = self._measure_height(combined_font, title1_text)
            
            table_start_y = int(title1_y + title1_h + GROUP_TITLE_GAP)

            idiom_section_height = 0
            if idiom_title_text:
                title_height = self._measure_height(idiom_title_font, idiom_title_text)
                if idiom_story_lines:
                    story_height = len(idiom_story_lines) * idiom_body_height + (len(idiom_story_lines) - 1) * IDIOM_LINE_SPACING
                else:
                    story_height = 0
                idiom_section_height = IDIOM_TOP_PADDING + title_height + (IDIOM_LINE_SPACING if story_height else 0) + story_height + IDIOM_BOTTOM_PADDING

            required_height = table_start_y + table_height + idiom_section_height
            canvas = ensure_canvas(required_height)
            draw = ImageDraw.Draw(canvas)
            img_w = canvas.width

            # Draw Table Header
            table_total_width = img_w * TABLE_WIDTH_RATIO
            table_left = (img_w - table_total_width) / 2

            # Draw Titles
            # Combined Title (Black) - Left aligned to table
            draw.text((table_left, title1_y), title1_text, font=combined_font, fill=(0, 0, 0, 255), anchor="la")

            # Column widths: 15% Rank, 45% Member, 40% Diff
            col0_width = table_total_width * 0.15
            col1_width = table_total_width * 0.45
            col2_width = table_total_width * 0.4
            header_y = table_start_y
            header_center_y = header_y + row_height_base / 2
            
            # Centers for text
            col0_center = table_left + col0_width / 2
            col1_center = table_left + col0_width + col1_width / 2
            col2_center = table_left + col0_width + col1_width + col2_width / 2
            
            col_titles = ["#", "成员", f"{metric_label}差值"]

            # Draw Header Background (Orange)
            draw.rectangle([table_left, header_y, table_left + table_total_width, header_y + row_height_base], fill=(255, 200, 120, 255))

            # Draw Header Text & Borders
            # Col 0 (#)
            draw.text((col0_center, header_center_y), col_titles[0], font=table_font, fill=(40, 40, 40, 255), anchor="mm")
            draw.rectangle([table_left, header_y, table_left + col0_width, header_y + row_height_base], outline=(80, 80, 80, 255), width=2)

            # Col 1 (Member)
            draw.text((col1_center, header_center_y), col_titles[1], font=table_font, fill=(40, 40, 40, 255), anchor="mm")
            draw.rectangle([table_left + col0_width, header_y, table_left + col0_width + col1_width, header_y + row_height_base], outline=(80, 80, 80, 255), width=2)
            
            # Col 2 (Diff)
            draw.text((col2_center, header_center_y), col_titles[2], font=table_font, fill=(40, 40, 40, 255), anchor="mm")
            draw.rectangle([table_left + col0_width + col1_width, header_y, table_left + table_total_width, header_y + row_height_base], outline=(80, 80, 80, 255), width=2)

            # Draw Rows
            # Load thresholds from env based on metric_key
            upper_key = f"THRESHOLD_{metric_key.upper()}_UPPER"
            lower_key = f"THRESHOLD_{metric_key.upper()}_LOWER"
            
            try:
                upper_threshold = int(os.environ.get(upper_key, 5000))
                lower_threshold = int(os.environ.get(lower_key, 0))
            except ValueError:
                upper_threshold = 5000
                lower_threshold = 0
            
            for row_idx, item in enumerate(items):
                member = item['name']
                delta = item['diff']
                rank = row_idx + 1
                
                # Use integer math for row positions to avoid gaps
                row_top = int(table_start_y + (row_idx + 1) * row_height_base)
                row_bottom = int(table_start_y + (row_idx + 2) * row_height_base)
                y_center = (row_top + row_bottom) / 2
                
                # Determine background color
                if delta >= upper_threshold:
                    fill_color = (144, 238, 144, 180) # Green
                elif delta <= lower_threshold:
                    fill_color = (255, 140, 0, 180) # Dark Yellow/Orange
                else:
                    fill_color = BG_COLOR # Light Yellow (Same as canvas)
                
                # Draw Col 0 (Rank)
                x0_0 = int(round(table_left))
                x1_0 = int(round(table_left + col0_width))
                draw.rectangle([x0_0, row_top, x1_0, row_bottom], fill=fill_color)
                draw.rectangle([x0_0, row_top, x1_0, row_bottom], outline=(120, 120, 120, 255), width=1)
                draw.text((col0_center, y_center), str(rank), font=table_font, fill=(0, 0, 0, 255), anchor="mm")

                # Draw Col 1 (Member)
                x0_1 = x1_0
                x1_1 = int(round(table_left + col0_width + col1_width))
                draw.rectangle([x0_1, row_top, x1_1, row_bottom], fill=fill_color)
                draw.rectangle([x0_1, row_top, x1_1, row_bottom], outline=(120, 120, 120, 255), width=1)
                draw.text((col1_center, y_center), str(member), font=table_font, fill=(0, 0, 0, 255), anchor="mm")
                
                # Draw Col 2 (Diff)
                x0_2 = x1_1
                x1_2 = int(round(table_left + table_total_width))
                draw.rectangle([x0_2, row_top, x1_2, row_bottom], fill=fill_color)
                draw.rectangle([x0_2, row_top, x1_2, row_bottom], outline=(120, 120, 120, 255), width=1)
                draw.text((col2_center, y_center), str(delta), font=table_font, fill=(0, 0, 0, 255), anchor="mm")

            # Draw Idiom
            if idiom_title_text:
                idiom_top = table_start_y + table_height + IDIOM_TOP_PADDING
                
                # Draw Idiom Background (Light Orange)
                idiom_bg_rect = [
                    20, 
                    idiom_top, 
                    img_w - 20, 
                    idiom_top + idiom_section_height - IDIOM_BOTTOM_PADDING + 10
                ]
                draw.rectangle(idiom_bg_rect, fill=(255, 245, 230, 255), outline=(255, 200, 150, 255), width=1)
                
                title_height = self._measure_height(idiom_title_font, idiom_title_text)
                # Left align idiom title (same x as story text)
                draw.text((60, idiom_top + IDIOM_TOP_PADDING/2 + title_height / 2), idiom_title_text, font=idiom_title_font, fill=(200, 100, 50, 255), anchor="lm")
                
                story_start_y = idiom_top + IDIOM_TOP_PADDING/2 + title_height + (IDIOM_LINE_SPACING if idiom_story_lines else 0)
                for idx, line in enumerate(idiom_story_lines):
                    y_pos = story_start_y + idx * (idiom_body_height + IDIOM_LINE_SPACING)
                    draw.text((60, y_pos), line, font=idiom_body_font, fill=(80, 80, 80, 255), anchor="la")

            # Save
            safe_group = group_name.replace('/', '_').replace('\\', '_')
            filename = f"compare_{safe_group}_{datetime.now().strftime('%H%M%S')}.png"
            out_path = os.path.join(output_dir, filename)
            canvas.save(out_path)
            
            # Return relative path or full path? 
            # We'll return filename and let the caller handle URL construction
            saved_paths.append({
                'group': group_name,
                'filename': filename
            })
            
        return saved_paths
