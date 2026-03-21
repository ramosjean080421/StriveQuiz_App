-- 1. ASEGURAR COLUMNAS (Por si acaso)
-- La tabla teacher_profiles ya debería existir con is_admin y is_approved

-- 2. HABILITAR DELETE PARA ADMINS EN teacher_profiles
DROP POLICY IF EXISTS "Admins pueden eliminar profesores" ON teacher_profiles;

CREATE POLICY "Admins pueden eliminar profesores" ON teacher_profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM teacher_profiles AS tp 
            WHERE tp.id = auth.uid() AND tp.is_admin = true
        )
    );
