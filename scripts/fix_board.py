import sys

filepath = r"c:\Users\Jean\.gemini\antigravity\scratch\PrismaQuiz-app\src\components\GameBoard.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

output_lines = []
skip = False

fixed_block = """                            y: path[iA].y + (path[iB].y - path[iA].y) * w 
                        };
                    } else if (boardPath.length > 0) {
                        const currentPos = uiPositions[player.id] ?? player.current_position;
                        const safeIdx = Math.min(Math.max(0, currentPos), boardPath.length - 1);
                        coordinate = boardPath[safeIdx];
                    }

                    return (
                        <div
"""

for i, line in enumerate(lines):
    if "x: path[iA].x" in line:
        output_lines.append(line)
        output_lines.append(fixed_block)
        skip = True
        continue
        
    if skip and "key={player.id}" in line:
        skip = False
        # Do not append key={player.id} because fixed block doesn't open the <div tag, or wait
        # The fixed block ends with `<div` and with no trailing space/newline.
        # But wait, line is `key={player.id}` normally inside the `div`.
        # So skip must end AT the line containing key={player.id}!
        # But we DO want key={player.id}! 
        # Wait, if `fixed_block` adds `<div`, and output_lines already has it.
        # Then next line in file ARE `key={player.id}` and `className=...`.
        # So we want to PRESERVE everything from `key={player.id}` onwards!
        # So skip must be set to false and the line appended!
        output_lines.append(line)
        continue

    if not skip:
        output_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("Fix applied")
