import base64

def encode_file(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

regular_b64 = encode_file('OpenSans-Regular.ttf')
bold_b64 = encode_file('OpenSans-Bold.ttf')

with open('js/fonts.js', 'w') as f:
    f.write(f"const OPENSANS_REGULAR_BASE64 = '{regular_b64}';\n")
    f.write(f"const OPENSANS_BOLD_BASE64 = '{bold_b64}';\n")
    
print("js/fonts.js created with OpenSans Regular and Bold")
