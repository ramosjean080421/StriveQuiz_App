const fs = require('fs');

const filePath = "c:\\Users\\Jean\\.gemini\\antigravity\\scratch\\PrismaQuiz-app\\src\\app\\teacher\\quiz\\builder\\page.tsx";
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const clearIndex = lines.findIndex(line => line.includes('const handleClear = () => {'));
if (clearIndex !== -1) {
    console.log("Found handleClear starting at index:", clearIndex);
    // lines[clearIndex] = const handleClear = () => {
    // lines[clearIndex+1] = setConfirmModal({
    // lines[clearIndex+2] = setBoardPath(boardPath.slice(0, -1));
    // lines[clearIndex+3] = setBoardPath([]);
    // lines[clearIndex+4] = setConfirmModal(null);
    // lines[clearIndex+5] = showToast("Ruta limpiada exitosamente.");
    // lines[clearIndex+6] = }
    // lines[clearIndex+7] = });
    // lines[clearIndex+8] = };
    
    // Replace indices from clearIndex to clearIndex+8 with a clean handleClear
    const restoredHandleClear = [
        "    const handleClear = () => {",
        "        setConfirmModal({",
        "            isOpen: true,",
        "            title: \"Limpiar Tablero\",",
        "            message: \"¿Estás seguro de que quieres borrar toda la ruta trazada? Esta acción no se puede deshacer.\",",
        "            isDestructive: true,",
        "            onConfirm: () => {",
        "                setBoardPath([]);",
        "                setConfirmModal(null);",
        "                showToast(\"Ruta limpiada exitosamente.\");",
        "            }",
        "        });",
        "    };"
    ];
    
    lines.splice(clearIndex, 9, ...restoredHandleClear);
    console.log("Restored handleClear successfully");
} else {
    console.log("handleClear start not found!");
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
console.log("Dynamic fix complete");
