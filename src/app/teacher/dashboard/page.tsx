"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Quiz {
    id: string;
    title: string;
    board_image_url: string;
    created_at: string;
    teacher_id: string;
    shared_with_emails?: string[];
    editors_emails?: string[];
}

export default function TeacherDashboard() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isApproved, setIsApproved] = useState<boolean>(true); // Por defecto true para no romper nada si no hay columna
    const [isCheckingApproval, setIsCheckingApproval] = useState(true);
    const [isAdmin, setIsAdmin] = useState<boolean>(false); // 👑 Estado dinámico para Administrador

    // Estados para Administración (Modal Invisible)
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [teachersList, setTeachersList] = useState<any[]>([]);
    const [loadingAdminData, setLoadingAdminData] = useState(false);

    // Estados para Modales Personalizados
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDestructive?: boolean } | null>(null);
    const [shareModal, setShareModal] = useState<{ isOpen: boolean, quizId: string, title: string, sharedEmails: string[], editorEmails: string[] } | null>(null);
    const [shareInput, setShareInput] = useState("");
    const [shareRole, setShareRole] = useState<"viewer" | "editor">("viewer");
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("sq-theme");
        const dark = stored === "dark" || (stored === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
        setIsDark(dark);
        document.documentElement.classList.toggle("dark", dark);
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.setItem("sq-theme", next ? "dark" : "light");
    };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    useEffect(() => {
        const checkUserAndFetchData = async () => {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData.user) {
                router.push("/teacher/login");
                setLoading(false);
                setIsCheckingApproval(false);
                return;
            }
            setUser(authData.user);

            // 1. Verificar Aprobación y Rol de Admin (Seguridad)
            try {
                const { data: profile, error: profileErr } = await supabase
                    .from("teacher_profiles")
                    .select("is_approved, is_admin")
                    .eq("id", authData.user.id)
                    .single();

                if (profileErr) {
                    if (profileErr.code === 'PGRST116') {
                        // Error PGRST116: La fila NO existe (Nuevo usuario con Google)
                        console.log("[Dashboard] Creando perfil de docente bloqueado para nuevo usuario...");
                        
                        await supabase.from("teacher_profiles").insert([{
                            id: authData.user.id,
                            email: authData.user.email?.toLowerCase(),
                            username: authData.user.email?.split('@')[0],
                            full_name: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0],
                            is_approved: false // Bloqueado por defecto
                        }]);
                        
                        setIsApproved(false);
                    } else {
                        // Si falla porque la columna no existe u otro error de sintaxis, 
                        // dejamos pasar para evitar que se caiga el sistema (Retrocompatibilidad).
                        console.warn("[Dashboard] Error leyendo is_approved. Bypassing lock.", profileErr.message);
                        setIsApproved(true);
                    }
                } else if (profile) {
                    setIsApproved(true); // TEMP: aprobación deshabilitada para migración
                    setIsAdmin(profile.is_admin === true || authData.user.email?.toLowerCase() === 'jheam2505@gmail.com');
                }
            } catch (e) {
                console.error("Error fetching approval status:", e);
                setIsApproved(true);
            } finally {
                setIsCheckingApproval(false);
            }

            // Fetch Quizzes del profesor y los compartidos con el
            const userEmail = authData.user.email?.toLowerCase();
            if (!userEmail) {
                setLoading(false);
                return;
            }

            const { data: quizzesData, error } = await supabase
                .from("quizzes")
                .select("*")
                .or(`teacher_id.eq.${authData.user.id},shared_with_emails.cs.{"${userEmail}"}`)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error al cargar tableros:", error);
            }

            if (quizzesData) {
                setQuizzes(quizzesData);
            }
            setLoading(false);
        };

        checkUserAndFetchData();
    }, [router]);

    // ==========================================
    // LOGICA PANEL ADMISTRADOR (MODAL)
    // ==========================================
    const fetchAllTeachersForAdmin = async () => {
        setLoadingAdminData(true);
        const { data, error } = await supabase
            .from("teacher_profiles")
            .select("*")
            .order("created_at", { ascending: false });
        
        if (data) setTeachersList(data);
        if (error) {
            console.error("Error fetching teachers admin modal:", error);
        }
        setLoadingAdminData(false);
    };

    useEffect(() => {
        let channel: any;
        if (isAdminModalOpen) {
            fetchAllTeachersForAdmin();

            // 🔴 CANAL EN TIEMPO REAL: Escuchar cambios en la tabla de profesores
            channel = supabase.channel('admin_teachers_realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_profiles' }, (payload) => {
                    console.log("Teacher profile changed:", payload);
                    if (payload.eventType === 'UPDATE') {
                        setTeachersList(prev => prev.map(t => t.id === payload.new.id ? (payload.new as any) : t));
                    } else if (payload.eventType === 'DELETE') {
                        setTeachersList(prev => prev.filter(t => t.id !== payload.old.id));
                    } else if (payload.eventType === 'INSERT') {
                        setTeachersList(prev => [payload.new as any, ...prev]);
                    }
                })
                .subscribe();
        }

        return () => {
             if (channel) supabase.removeChannel(channel);
        };
    }, [isAdminModalOpen]);

    const handleApproveTeacher = async (id: string, approve: boolean) => {
        const { error } = await supabase
            .from("teacher_profiles")
            .update({ is_approved: approve })
            .eq("id", id);
        
        if (error) showToast("Error al procesar: " + error.message, "error");
        else {
            showToast(approve ? "✅ Profesor aprobado con éxito" : "🔒 Profesor bloqueado con éxito");
            // 🚀 Actualización Local Instantánea
            setTeachersList(prev => prev.map(t => t.id === id ? { ...t, is_approved: approve } : t));
            fetchAllTeachersForAdmin();
        }
    };

    const handleToggleAdminRole = async (id: string, makeAdmin: boolean) => {
        const { error } = await supabase
            .from("teacher_profiles")
            .update({ is_admin: makeAdmin })
            .eq("id", id);
        
        if (error) {
            showToast("Error. Recuerda añadir la columna `is_admin` en Supabase: " + error.message, "error");
        } else {
            showToast(makeAdmin ? "👑 Ascendido a Administrador" : "💼 Removido de Administración");
            setTeachersList(prev => prev.map(t => t.id === id ? { ...t, is_admin: makeAdmin } : t));
            fetchAllTeachersForAdmin();
        }
    };

    const handleDeleteTeacher = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Remover Profesor",
            message: "¿Estás completamente seguro de que quieres eliminar este perfil de profesor de la plataforma?",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(null);
                const { data, error } = await supabase.from("teacher_profiles").delete().eq("id", id).select();
                if (error) {
                    showToast("Error al eliminar: " + error.message, "error");
                }
                else if (!data || data.length === 0) {
                    showToast("Error: No se pudo eliminar el profesor. Revisa los permisos.", "error");
                }
                else {
                    showToast("🔴 Profesor eliminado de la plataforma");
                    setTeachersList(prev => prev.filter(t => t.id !== id));
                    fetchAllTeachersForAdmin();
                }
            }
        });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const handleDeleteQuiz = (quizId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Eliminar Tablero",
            message: "¿Estás seguro de que quieres eliminar este tablero? Esta acción no se puede deshacer.",
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
                    if (error) throw error;
                    setQuizzes(quizzes.filter(q => q.id !== quizId));
                    showToast("Tablero eliminado exitosamente.", "success");
                } catch (err: any) {
                    showToast("Error al eliminar: " + err.message, "error");
                }
            }
        });
    };

    const handleDuplicateQuiz = (quizId: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Duplicar Tablero Mágico",
            message: "¿Deseas crear una copia exacta de este tablero para poder modificarlo y usarlo en otra clase?",
            onConfirm: async () => {
                setConfirmModal(null);
                try {
                    // 1. Obtener Quiz original
                    const { data: originalQuiz, error: errQuiz } = await supabase.from("quizzes").select("*").eq("id", quizId).single();
                    if (errQuiz || !originalQuiz) throw new Error("No se pudo encontrar el tablero original.");

                    // 2. Crear copia del Quiz
                    const { id: _, created_at: __, ...quizData } = originalQuiz;
                    const newTitle = `Copia de ${quizData.title}`;

                    const { data: newQuiz, error: errInsert } = await supabase.from("quizzes").insert({
                        ...quizData,
                        title: newTitle,
                        teacher_id: user.id, // El nuevo dueño es quien duplica
                        shared_with_emails: [] // Empieza sin compartir para ser independiente
                    }).select().single();
                    if (errInsert || !newQuiz) throw new Error("Error creando el nuevo tablero.");

                    // 3. Obtener preguntas originales
                    const { data: originalQuestions, error: errQ } = await supabase.from("questions").select("*").eq("quiz_id", quizId);
                    if (errQ) throw errQ;

                    // 4. Copiar preguntas al nuevo quiz
                    if (originalQuestions && originalQuestions.length > 0) {
                        const newQuestions = originalQuestions.map(q => {
                            const { id, created_at, quiz_id, ...qData } = q;
                            return { ...qData, quiz_id: newQuiz.id };
                        });
                        const { error: errInsertQ } = await supabase.from("questions").insert(newQuestions);
                        if (errInsertQ) throw errInsertQ;
                    }

                    // 5. Actualizar la vista
                    setQuizzes([newQuiz, ...quizzes]);
                    showToast("¡Tablero duplicado con éxito!", "success");
                } catch (err: any) {
                    showToast("Error al duplicar: " + err.message, "error");
                }
            }
        });
    };

    const handleOpenShareModal = (quizId: string, currentShared: string[] | null, currentEditors: string[] | null) => {
        setShareModal({
            isOpen: true,
            quizId,
            title: "Gestionar Accesos a Colegas",
            sharedEmails: currentShared || [],
            editorEmails: currentEditors || []
        });
        setShareInput("");
        setShareRole("viewer");
    };

    const handleAddShare = async () => {
        if (!shareModal) return;
        const emailToShare = shareInput.trim().toLowerCase();

        if (!emailToShare || !emailToShare.includes("@")) {
            showToast("Por favor ingresa un correo válido.", "error");
            return;
        }

        if (shareModal.sharedEmails.includes(emailToShare)) {
            showToast("Este correo ya tiene acceso a este tablero. Puedes removerlo y volverlo a agregar con otro rol si lo deseas.", "error");
            return;
        }

        try {
            const { data: userExists } = await supabase.rpc('check_user_exists', { lookup_email: emailToShare });
            if (userExists === false) {
                showToast("Este correo NO pertenece a un profesor registrado.", "error");
                return;
            }

            const newShared = [...shareModal.sharedEmails, emailToShare];
            const newEditors = shareRole === "editor"
                ? Array.from(new Set([...shareModal.editorEmails, emailToShare]))
                : shareModal.editorEmails.filter(e => e !== emailToShare);

            const { error } = await supabase.from("quizzes").update({
                shared_with_emails: newShared,
                editors_emails: newEditors
            }).eq("id", shareModal.quizId);

            if (error) throw error;

            showToast(`¡Compartido como ${shareRole === 'editor' ? 'Editor' : 'Lector'}!`, "success");
            setQuizzes(quizzes.map(q => q.id === shareModal.quizId ? { ...q, shared_with_emails: newShared, editors_emails: newEditors } : q));
            setShareModal({ ...shareModal, sharedEmails: newShared, editorEmails: newEditors });
            setShareInput("");
        } catch (err: any) {
            showToast("Error al compartir: " + err.message, "error");
        }
    };

    const handleRemoveShare = async (emailToRemove: string) => {
        if (!shareModal) return;
        try {
            const newShared = shareModal.sharedEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
            const newEditors = shareModal.editorEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());

            const { error } = await supabase.from("quizzes").update({
                shared_with_emails: newShared,
                editors_emails: newEditors
            }).eq("id", shareModal.quizId);

            if (error) throw error;

            showToast(`Se ha revocado el acceso`, "success");
            setQuizzes(quizzes.map(q => q.id === shareModal.quizId ? { ...q, shared_with_emails: newShared, editors_emails: newEditors } : q));
            setShareModal({ ...shareModal, sharedEmails: newShared, editorEmails: newEditors });
        } catch (err: any) {
            showToast("Error al remover acceso: " + err.message, "error");
        }
    };

    const handleToggleRole = async (email: string) => {
        if (!shareModal) return;
        try {
            const isCurrentlyEditor = shareModal.editorEmails.some(e => e.toLowerCase() === email.toLowerCase());
            const newEditors = isCurrentlyEditor
                ? shareModal.editorEmails.filter(e => e.toLowerCase() !== email.toLowerCase())
                : Array.from(new Set([...shareModal.editorEmails, email.toLowerCase()]));

            const { error } = await supabase.from("quizzes").update({
                editors_emails: newEditors
            }).eq("id", shareModal.quizId);

            if (error) throw error;

            showToast(`Rol actualizado a ${isCurrentlyEditor ? 'Lector' : 'Editor'}`, "success");
            setQuizzes(quizzes.map(q => q.id === shareModal.quizId ? { ...q, editors_emails: newEditors } : q));
            setShareModal({ ...shareModal, editorEmails: newEditors });
        } catch (err: any) {
            showToast("Error al cambiar rol: " + err.message, "error");
        }
    };

    if (loading || isCheckingApproval) return (
        <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 overflow-hidden">
            <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-indigo-400 border-t-indigo-600 rounded-full animate-spin"></div>
                <h2 className="mt-4 text-2xl font-bold text-indigo-800 tracking-tight">Cargando tu espacio...</h2>
            </div>
        </div>
    );

    if (!isApproved) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden p-6 relative">
                {/* Elementos decorativos */}
                <div className="absolute top-10 left-10 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-blob"></div>
                <div className="absolute bottom-10 right-10 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-[80px] opacity-30 animate-blob animation-delay-2000"></div>

                <div className="max-w-md w-full bg-white/80 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/50 shadow-2xl text-center flex flex-col items-center relative z-10">
                    <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center text-3xl mb-6 shadow-inner transform hover:rotate-6 transition-transform">
                        🔒
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-3">Cuenta en Revisión</h2>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
                        Tu cuenta de profesor ha sido creada con éxito. Sin embargo, para mantener la seguridad de las salas, un Administrador debe verificar tu identidad antes de que puedas usar el sistema.
                    </p>
                    
                    <div className="w-full bg-amber-50 border border-amber-200/50 rounded-2xl p-4 mb-8">
                        <p className="text-xs text-amber-800 font-bold flex items-center justify-center gap-2">
                             <span>📩</span> Se te notificará por correo cuando sea activada.
                        </p>
                    </div>

                    <button 
                        onClick={handleLogout}
                        className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>🚪</span> Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 font-sans relative">

            {/* TOAST FLOTANTE */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl font-bold flex items-center gap-3 animate-slide-up border ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}>
                    <span className="text-xl">{toast.type === 'success' ? '✅' : '🚨'}</span>
                    {toast.message}
                </div>
            )}

            {/* MODAL CONFIRMACION */}
            {confirmModal && confirmModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full transform transition-all animate-bounce-short text-center border border-gray-100 dark:border-slate-800">
                        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${confirmModal.isDestructive ? 'bg-red-100 text-red-500' : 'bg-indigo-100 text-indigo-500'}`}>
                            <span className="text-3xl">{confirmModal.isDestructive ? '🗑️' : '📋'}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-gray-500 dark:text-slate-400 font-medium leading-relaxed mb-6">{confirmModal.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.onConfirm} className={`flex-1 py-3 px-4 font-bold rounded-xl text-white transition-all active:scale-95 ${confirmModal.isDestructive ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL GESTOR DE ACCESOS (Compartir / Descompartir) */}
            {shareModal && shareModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full transform transition-all animate-bounce-short border border-gray-100 dark:border-slate-800 max-h-[90vh] flex flex-col">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
                            <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shrink-0">
                                <span className="text-2xl">🤝</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">{shareModal.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Docentes invitados a editar y jugar este tablero</p>
                            </div>
                        </div>

                        {/* Lista Animada de Compartidos */}
                        <div className="flex-1 overflow-y-auto min-h-[100px] mb-6 space-y-2 pr-2">
                            {shareModal.sharedEmails.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 dark:text-slate-500 font-medium text-sm">
                                    Nadie tiene acceso todavía.<br />¡Invita a tu primer colega!
                                </div>
                            ) : (
                                shareModal.sharedEmails.map((email, idx) => {
                                    const isEditor = shareModal.editorEmails.includes(email);
                                    return (
                                        <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 group/item hover:bg-white dark:hover:bg-slate-700 transition-colors">
                                            <div className="flex flex-col">
                                                <div className="font-bold text-gray-700 dark:text-slate-200 truncate max-w-[200px]">{email}</div>
                                                <div className={`text-[10px] font-black uppercase tracking-wider ${isEditor ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                                    {isEditor ? '✍️ Editor' : '👁️ Lector'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    title={isEditor ? "Cambiar a modo lectura (Solo Ver)" : "Cambiar a modo editor (Puede modificar)"}
                                                    onClick={() => handleToggleRole(email)}
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isEditor
                                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                        }`}
                                                >
                                                    {isEditor ? '👁️' : '✍️'}
                                                </button>
                                                <button
                                                    title="Revocar acceso"
                                                    onClick={() => handleRemoveShare(email)}
                                                    className="bg-red-600 hover:bg-red-700 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0"
                                                >
                                                    ✖
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Area para agregar nuevos invitados */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            <label className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-3 block">Compartir con profesor</label>
                            <div className="flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        value={shareInput}
                                        onChange={(e) => setShareInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddShare()}
                                        placeholder="correo@ejemplo.com"
                                        className="flex-1 px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    />
                                    <button
                                        onClick={handleAddShare}
                                        disabled={!shareInput.trim()}
                                        className="px-6 py-3 font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        Invitar
                                    </button>
                                </div>
                                <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl w-full">
                                    <button
                                        onClick={() => setShareRole("viewer")}
                                        className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shareRole === "viewer" ? "bg-white dark:bg-slate-700 text-indigo-600" : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"}`}
                                    >
                                        👁️ Solo Ver
                                    </button>
                                    <button
                                        onClick={() => setShareRole("editor")}
                                        className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${shareRole === "editor" ? "bg-white dark:bg-slate-700 text-indigo-600" : "text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"}`}
                                    >
                                        ✍️ Puede Editar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button onClick={() => setShareModal(null)} className="w-full py-3 px-4 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors">
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL ADMINISTRADOR (Invisible Trigger) */}
            {isAdminModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md px-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-5xl w-full transform transition-all animate-bounce-short border border-gray-100 dark:border-slate-800 max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
                        {/* Decoraciones de fondo */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>

                        {/* Cabecera */}
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <span className="text-2xl">👑</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Panel de Administración</h3>
                                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Gestión de roles de docentes y solicitudes de validación</p>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAdminModalOpen(false);
                                }} 
                                className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition-all border border-transparent shadow-md active:scale-95"
                            >
                                <span>🔒</span> CERRAR
                            </button>
                        </div>

                        {/* Cuerpo Grid 2 Columnas */}
                        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 pr-2">
                            {/* Columna Izquierda: ADMINISTRADORES Y DOCENTES */}
                            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100/80 dark:border-slate-700 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                <h4 className="text-sm font-black text-gray-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                    <span className="text-indigo-500">🛡️</span> Administradores
                                </h4>
                                
                                {/* Lista de Profesores que son Admins */}
                                <div className="space-y-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm mb-4">
                                    {teachersList.filter(t => t.is_admin).map((admin) => (
                                        <div key={admin.id} className="flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-700 dark:to-slate-700 p-3 rounded-xl border border-gray-100 dark:border-slate-600 shadow-sm">
                                            <div className="max-w-[150px] sm:max-w-none truncate flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-md">
                                                    {admin.full_name?.charAt(0) || 'A'}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-gray-900 dark:text-slate-100 truncate">{admin.full_name || admin.username}</p>
                                                    <p className="text-[9px] text-gray-400 dark:text-slate-400 font-medium truncate">{admin.email}</p>
                                                </div>
                                            </div>
                                            {/* Acciones */}
                                            <div className="flex gap-1">
                                                {admin.email?.toLowerCase() !== 'jheam2505@gmail.com' ? (
                                                    <button 
                                                        onClick={() => handleToggleAdminRole(admin.id, false)}
                                                        className="text-[9px] font-black bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-md transition-colors"
                                                    >
                                                        Remover
                                                    </button>
                                                ): (
                                                    <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-md border border-transparent">PROPIETARIO 👑</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <h4 className="text-sm font-black text-gray-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5 mt-1 border-t border-gray-200/50 dark:border-slate-700 pt-3">
                                    <span className="text-emerald-500">👨‍🏫</span> Docentes Aprobados
                                </h4>

                                {/* Lista de Profesores Aprobados (no admins) */}
                                <div className="space-y-2 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 shadow-sm mb-4">
                                    {teachersList.filter(t => t.is_approved && !t.is_admin).length === 0 ? (
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center py-2">No hay otros docentes aprobados.</p>
                                    ) : (
                                        teachersList.filter(t => t.is_approved && !t.is_admin).map((teach) => (
                                            <div key={teach.id} className="flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                <div className="max-w-[150px] sm:max-w-none truncate flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-black text-white shadow-md">
                                                        {teach.full_name?.charAt(0) || 'P'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900 dark:text-white truncate">{teach.full_name || teach.username}</p>
                                                        <p className="text-[9px] text-gray-400 dark:text-slate-500 font-medium truncate">{teach.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => handleDeleteTeacher(teach.id)}
                                                        className="text-[9px] font-black bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-md transition-colors"
                                                    >
                                                        Borrar
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Formulario rápido para ascender */}
                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm mt-auto">
                                    <p className="text-[10px] font-black text-gray-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Ascender Nuevo Administrador</p>
                                    <div className="flex gap-2">
                                        <select
                                            className="flex-1 text-xs p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.value) handleToggleAdminRole(e.target.value, true);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="" disabled className="text-gray-900 font-bold">Selecciona un docente aprobado...</option>
                                            {teachersList.filter(t => !t.is_admin && t.is_approved).map(t => (
                                                <option key={t.id} value={t.id} className="text-gray-900 font-bold">{t.full_name || t.username} ({t.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha: SOLICITUDES PENDIENTES */}
                            <div className="flex flex-col h-full bg-amber-50/20 dark:bg-amber-900/5 p-5 rounded-3xl border border-amber-100/50 dark:border-amber-900/20">
                                <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                    <span className="text-amber-500">📩</span> Solicitudes Pendientes
                                </h4>

                                <div className="space-y-2 overflow-y-auto flex-1 min-h-[250px] bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-amber-100/80 dark:border-slate-700 p-4 shadow-sm">
                                    {teachersList.filter(t => !t.is_approved).length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <span className="text-4xl mb-2 animate-pulse">🎉</span>
                                            <p className="text-xs font-black text-gray-500 dark:text-slate-400">Todo limpio.</p>
                                            <p className="text-[10px] text-gray-400 dark:text-slate-500">No hay docentes esperando</p>
                                        </div>
                                    ) : (
                                        teachersList.filter(t => !t.is_approved).map((req) => (
                                            <div key={req.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-100/40 dark:border-slate-700 shadow-sm">
                                                <div className="max-w-[150px] sm:max-w-none truncate flex items-center gap-2">
                                                    <div className="w-8 h-8 shrink-0 rounded-full bg-amber-600 flex items-center justify-center text-xs font-black text-white shadow-md select-none">
                                                        {(req.full_name || req.username || 'P').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '').charAt(0).toUpperCase() || 'P'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900 dark:text-white truncate">{req.full_name || req.username}</p>
                                                        <p className="text-[9px] text-gray-400 dark:text-slate-500 font-medium truncate">{req.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5 ml-2">
                                                    <button 
                                                        onClick={() => handleApproveTeacher(req.id, true)}
                                                        className="text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95"
                                                    >
                                                        Aprobar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteTeacher(req.id)}
                                                        className="text-[10px] font-black bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl transition-all shadow-md active:scale-95"
                                                    >
                                                        Rechazar
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Lleno de Color */}
            <header className="flex-shrink-0 bg-white dark:bg-slate-900 border-b border-indigo-100 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-20">
                <div className="flex items-center gap-0 sm:gap-2">
                    <img
                        src="/logo1.png"
                        alt="Logo StriveQuiz"
                        className="w-16 sm:w-20 h-auto object-contain mix-blend-multiply dark:mix-blend-normal transform hover:rotate-2 hover:scale-105 transition-all duration-300"
                    />
                    <span className="text-[1.7rem] sm:text-4xl font-black text-[#7D32FF] tracking-tight ml-1">
                        StriveQuiz
                    </span>
                    <span className="bg-[#7D32FF]/10 text-[#7D32FF] font-black px-3 py-1 rounded-full text-xs hidden md:block ml-4 border border-[#7D32FF]/20 relative top-0.5">
                        Panel de Profesor
                    </span>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Botón toggle de tema */}
                    <button
                        onClick={toggleTheme}
                        title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-indigo-100 dark:border-slate-700 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 transition-all text-lg"
                    >
                        {isDark ? '☀️' : '🌙'}
                    </button>

                    <div
                        className={`flex-col text-right hidden md:flex justify-center ${isAdmin ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 px-3 py-1.5 rounded-2xl transition-all border border-transparent hover:border-indigo-100/80 dark:hover:border-slate-700 group/admin-btn' : ''}`}
                        onClick={() => {
                            if (isAdmin) {
                                setIsAdminModalOpen(true);
                            }
                        }}
                    >
                        <span className="text-sm font-bold text-gray-800 dark:text-slate-100 flex items-center gap-1">
                            {isAdmin ? "Administrador(a)" : "Profesor(a)"}
                            {isAdmin && <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 px-1 rounded-md opacity-0 group-hover/admin-btn:opacity-100 transition-opacity">Panel ⚙️</span>}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{user?.user_metadata?.full_name || user?.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/teacher/settings"
                            className="flex items-center gap-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 px-4 py-2.5 rounded-xl transition-all"
                        >
                            <span>⚙️ Ajustes</span>
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition-all border border-transparent"
                        >
                            <span className="hidden sm:inline">Cerrar Sesión</span>
                            <span className="sm:hidden">Salir</span>
                            <span className="bg-red-700/50 px-1.5 rounded text-white font-normal">🚪</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Layout Principal con Sub-Header Creador */}
            <main className="flex-1 flex flex-col overflow-hidden relative p-4 sm:p-8 z-10">
                {/* Elementos Decorativos Fijos */}
                <div className="absolute top-10 left-10 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 -z-10 animate-blob"></div>
                <div className="absolute top-10 right-10 w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-20 -z-10 animate-blob animation-delay-2000"></div>

                {/* Controles de Acción Principal */}
                <div className="flex-shrink-0 flex flex-col md:flex-row justify-between items-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-white dark:border-slate-800 mb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Mis Tableros Mágicos</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-medium">Gestiona tus aventuras y lanza nuevas salas de juego.</p>
                    </div>
                    <Link
                        href="/teacher/quiz/builder"
                        className="mt-4 md:mt-0 inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:scale-95"
                    >
                        <span className="text-xl leading-none">+</span> Crear Nuevo Tablero
                    </Link>
                </div>

                {/* Grid de Tableros Scrolleable */}
                <div className="flex-1 overflow-y-auto px-1 pb-10 scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-transparent">
                    {quizzes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm rounded-[2.5rem] p-12 border border-white/50 dark:border-slate-800 border-dashed">
                            <div className="text-8xl mb-6">🚀</div>
                            <h3 className="text-2xl font-extrabold text-gray-800 dark:text-white">El lienzo está en blanco</h3>
                            <p className="mt-3 text-lg text-gray-600 dark:text-slate-400 max-w-md">No tienes tableros aún. ¡Empieza a crear tu primera aventura interactiva en StriveQuiz ahora mismo!</p>
                            <Link href="/teacher/quiz/builder" className="mt-8 text-indigo-600 font-bold hover:text-indigo-800 underline decoration-indigo-300 underline-offset-4 decoration-2">Quiero crear mi primer tablero &rarr;</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {quizzes.map((quiz) => (
                                <div key={quiz.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg rounded-[2rem] border border-white dark:border-slate-800 transition-all duration-300 group flex flex-col overflow-hidden transform hover:-translate-y-1">
                                                {/* Cabecera de Tarjeta con Fondo de Mapa */}
                                                <div 
                                                    className="px-6 py-8 flex-1 relative overflow-hidden cursor-pointer group/header"
                                                    onClick={() => {
                                                        const userEmail = user?.email?.toLowerCase() || "";
                                                        const isOwner = quiz.teacher_id === user?.id;
                                                        const isEditor = quiz.editors_emails?.some(e => e.toLowerCase() === userEmail);
                                                        if (isOwner || isEditor) {
                                                            router.push(`/teacher/quiz/builder?editId=${quiz.id}`);
                                                        } else {
                                                            showToast("Acceso de Solo Lectura. Solicita permiso de editor al dueño para modificar.", "error");
                                                        }
                                                    }}
                                                >
                                                    {/* Imagen de Fondo Borrosa */}
                                                    {quiz.board_image_url && (
                                                        <div
                                                            className={`absolute inset-0 z-0 opacity-20 group-hover/header:opacity-40 transition-opacity duration-500 blur-[2px] scale-110 group-hover/header:scale-125 ${quiz.board_image_url === '/LUDO_PROCEDURAL' ? 'bg-gradient-to-br from-red-500 via-blue-500 to-emerald-500' : ''}`}
                                                            style={quiz.board_image_url !== '/LUDO_PROCEDURAL' ? {
                                                                backgroundImage: `url(${quiz.board_image_url})`,
                                                                backgroundSize: 'cover',
                                                                backgroundPosition: 'center'
                                                            } : {}}
                                                        >
                                                            {quiz.board_image_url === '/LUDO_PROCEDURAL' && (
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                                                    <span className="text-9xl rotate-12">🎲</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Gradiente extra para legibilidad */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-slate-900 dark:via-slate-900/80 z-0"></div>

                                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
                                                    <div className="relative z-10">
                                                                 <div className="flex flex-wrap gap-1.5 items-start mb-3">
                                                            <div className={`backdrop-blur-sm w-max px-3 py-1.5 rounded-lg text-xs font-black border ${quiz.teacher_id === user?.id ? "bg-indigo-100/90 text-indigo-700 border-indigo-200/50" : "bg-purple-100/90 text-purple-700 border-purple-200/50"}`}>
                                                                {quiz.teacher_id === user?.id ? "Mio" : "Compartido"}
                                                            </div>
                                                            {(quiz.shared_with_emails?.length || 0) > 0 && quiz.teacher_id === user?.id && (
                                                                <div className="bg-emerald-100/90 backdrop-blur-sm text-emerald-700 px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-emerald-200/50 flex items-center gap-1" title={`${quiz.shared_with_emails?.length} colaboradores`}>
                                                                    🤝 {quiz.shared_with_emails?.length}
                                                                </div>
                                                            )}
                                                            {quiz.board_image_url && (
                                                                <div className="bg-amber-100/90 backdrop-blur-sm text-amber-800 px-3 py-1.5 rounded-lg text-xs font-black border border-amber-200/50 flex items-center gap-1.5" title="Escenario Seleccionado">
                                                                    <span className="text-sm">🗺️</span>
                                                                    <span className="capitalize">{quiz.board_image_url === '/LUDO_PROCEDURAL' ? "LUDO" : (quiz.board_image_url.split('/').pop()?.split('.')[0].replace(/-/g, ' ') || "Mapa")}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-800 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight">
                                                            {quiz.title}
                                                        </h3>
                                                        <p className="text-xs font-bold text-gray-500 dark:text-slate-400 mt-3 flex items-center gap-1.5 bg-white/60 dark:bg-slate-800/60 w-max px-2 py-1 rounded-md">
                                                            <span>📅</span> Creado el {new Date(quiz.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Controles de Tarjeta */}
                                                <div className="bg-gray-50/50 dark:bg-slate-800/50 p-4 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-2 relative z-20">
                                                    {/* SOLO EL DUEÑO PUEDE GESTIONAR ACCESOS */}
                                                    {quiz.teacher_id === user?.id ? (
                                                        <div className="mb-1">
                                                            <button
                                                                onClick={() => handleOpenShareModal(quiz.id, quiz.shared_with_emails || [], quiz.editors_emails || [])}
                                                                className="w-full text-[10px] font-black uppercase text-white bg-indigo-600 border border-indigo-700 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                                                            >
                                                                🤝 Gestionar Colaboradores
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="mb-1 py-1.5 text-center text-[9px] font-bold text-gray-400 dark:text-slate-500 bg-gray-100/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-gray-200 dark:border-slate-700 uppercase tracking-tighter">
                                                            Colaboración restringida al dueño
                                                        </div>
                                                    )}

                                                    <Link
                                                        href={`/teacher/game/new?quizId=${quiz.id}`}
                                                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 text-sm rounded-xl transition-all transform active:scale-95"
                                                    >
                                                        <span className="text-base">▶️</span> Lanzar Partida
                                                    </Link>

                                                    <div className="grid grid-cols-3 gap-2">
                                                        {(() => {
                                                            const userEmail = user?.email?.toLowerCase() || "";
                                                            const isOwner = quiz.teacher_id === user?.id;
                                                            const isEditor = quiz.editors_emails?.some(e => e.toLowerCase() === userEmail);
                                                            const canEdit = isOwner || isEditor;

                                                            return (
                                                                <>
                                                                    {canEdit ? (
                                                                        <Link
                                                                            href={`/teacher/quiz/builder?editId=${quiz.id}`}
                                                                            className="flex flex-col items-center justify-center py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-xl transition-all text-center"
                                                                            title="Editar Mapa e Itinerario"
                                                                        >
                                                                            <span className="text-lg mb-0.5">🗺️</span> Mapa
                                                                        </Link>
                                                                    ) : (
                                                                        <div
                                                                            className="flex flex-col items-center justify-center py-2 bg-gray-100 text-gray-400 font-bold text-[11px] rounded-xl cursor-not-allowed border border-gray-200 opacity-60"
                                                                            title="Solo Lectura: Solicita permiso de editor al dueño"
                                                                        >
                                                                            <span className="text-lg mb-0.5 grayscale">🗺️</span> Mapa
                                                                        </div>
                                                                    )}

                                                                    {canEdit ? (
                                                                        <Link
                                                                            href={`/teacher/quiz/${quiz.id}/questions`}
                                                                            className="flex flex-col items-center justify-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded-xl transition-all text-center"
                                                                            title="Editar Banco de Preguntas"
                                                                        >
                                                                            <span className="text-lg mb-0.5">📝</span> Preguntas
                                                                        </Link>
                                                                    ) : (
                                                                        <div
                                                                            className="flex flex-col items-center justify-center py-2 bg-gray-100 text-gray-400 font-bold text-[11px] rounded-xl cursor-not-allowed border border-gray-200 opacity-60"
                                                                            title="Solo Lectura: Solicita permiso de editor al dueño"
                                                                        >
                                                                            <span className="text-lg mb-0.5 grayscale">📝</span> Preguntas
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}

                                                        <button
                                                            onClick={() => handleDuplicateQuiz(quiz.id)}
                                                            className="flex flex-col items-center justify-center py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-xl transition-all group text-center"
                                                            title="Duplicar para tu propia cuenta"
                                                        >
                                                            <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">📋</span> Copiar
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                                        <Link
                                                            href={`/teacher/quiz/${quiz.id}/reports`}
                                                            className="flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-[10px] uppercase rounded-xl transition-all"
                                                        >
                                                            <span>📊</span> Reportes
                                                        </Link>

                                                        {/* SOLO EL DUEÑO PUEDE BORRAR */}
                                                        {quiz.teacher_id === user?.id ? (
                                                            <button
                                                                onClick={() => handleDeleteQuiz(quiz.id)}
                                                                className="flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase rounded-xl transition-all"
                                                            >
                                                                <span>🗑️</span> Borrar
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-300 dark:text-slate-600 text-[9px] uppercase font-black rounded-xl border border-gray-100 dark:border-slate-700" title="Tablero compartido (Sujeto a dueño)">
                                                                Protegido
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                    )}
                </div>
            </main>
        </div>
    );
}
