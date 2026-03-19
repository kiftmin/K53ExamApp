import json

input_file = r'C:\projects\K53ExamApp\data\questiondata5_mapped.json'
output_file = r'C:\projects\K53ExamApp\data\questiondata5_mapped.json'

control_images = {
    "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1769790677/C2_Controls_n8gfk3.png",
    "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1769791439/C3_Controls_eevskm.png",
    "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1769790677/C2_Controls111"
}

def update_categories():
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        counts_before = {1: 0, 2: 0, 3: 0}
        counts_after = {1: 0, 2: 0, 3: 0}

        for entry in data:
            old_category = entry.get('category')
            if old_category in counts_before:
                counts_before[old_category] += 1
            
            # Logic:
            # 1. No image (contains_image: false) -> category 1
            # 2. Controls image -> category 3
            # 3. Otherwise (image but not control) -> category 2
            
            if not entry.get('contains_image'):
                entry['category'] = 1
            elif entry.get('image_link') in control_images:
                entry['category'] = 3
            else:
                entry['category'] = 2
            
            new_category = entry.get('category')
            if new_category in counts_after:
                counts_after[new_category] += 1

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

        print(f"Update successful.")
        print(f"Categories Before: {counts_before}")
        print(f"Categories After:  {counts_after}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_categories()
