
import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, User, X, Info, CheckCircle } from 'lucide-react';
import { api, supabase, setOrganizationId } from '../../services/api';
import { User as UserType } from '../../types';
import { generateId } from '../../services/utils';

interface LoginFormProps {
    onLogin: (user: UserType) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
    const [isSignup, setIsSignup] = useState(false);
    const [formData, setFormData] = useState({ 
        name: '', email: '', password: '', confirmPassword: '', inviteCode: '',
        organizationAction: 'join' as 'create' | 'join',
        organizationName: '',
        selectedOrganization: '',
        supabaseUrl: '',
        supabaseKey: ''
    });
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const loadingRef = useRef(loading);
    useEffect(() => { loadingRef.current = loading; }, [loading]);

    const [organizations, setOrganizations] = useState<string[]>([]);
    
    // Cache state
    const [cachedUser, setCachedUser] = useState<{name: string, email: string} | null>(null);
    const [useCachedUser, setUseCachedUser] = useState(false);

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const ints = await api.load('Integrations');
                let orgList = ints.map((i: any) => {
                    let org = i.organization;
                    if (typeof org === 'string' && org.startsWith('"') && org.endsWith('"')) {
                        org = org.slice(1, -1);
                    }
                    return org;
                }).filter(Boolean);
                orgList = Array.from(new Set(orgList));
                if (orgList.length === 0) orgList = ['AZRE'];
                setOrganizations(orgList);
                setFormData(prev => prev.selectedOrganization ? prev : { ...prev, selectedOrganization: orgList[0] as string });
            } catch {
                setOrganizations(['AZRE']);
                setFormData(prev => prev.selectedOrganization ? prev : { ...prev, selectedOrganization: 'AZRE' });
            }
        };
        fetchOrganizations();

        const savedLastUser = localStorage.getItem('azre-last-user');
        if (savedLastUser) {
            try {
                const parsed = JSON.parse(savedLastUser);
                if (parsed.email && parsed.name) {
                    setCachedUser(parsed);
                    setFormData(prev => ({ ...prev, email: parsed.email }));
                    setUseCachedUser(true);
                }
            } catch (e) {
                localStorage.removeItem('azre-last-user');
            }
        }
    }, []);

    // Handle Google OAuth Redirect / Session Check
    useEffect(() => {
        const checkSession = async () => {
            try {
                // Check for active session from OAuth redirect
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;
                
                if (session?.user) {
                    // If we are functioning inside the popup, let the parent window handle things after session is parsed and stored
                    if (window.opener) {
                        window.close();
                        return;
                    }
                    
                    setLoading(true);
                    const email = session.user.email;
                    
                    // Robust user loading with retries handled in api.load now
                    const users = await api.load('Users') as UserType[];
                    let user = users.find(u => u.email === email);

                    if (!user) {
                        // Check if we saved a pending signup organization request
                        const pendingOrgJson = localStorage.getItem('azre_pending_signup');
                        let orgName = 'My Organization';
                        let orgId = 'org_' + Math.random().toString(36).substring(2, 9);
                        let isNewOrg = true;
                        let inviteCode = 'azre-invite';
                        let customName = session.user.user_metadata?.full_name || email?.split('@')[0] || 'Google User';
                        
                        if (pendingOrgJson) {
                            try {
                                const pendingData = JSON.parse(pendingOrgJson);
                                if (pendingData.email === email) {
                                    orgName = pendingData.organizationName;
                                    orgId = pendingData.organizationId;
                                    isNewOrg = pendingData.isNew;
                                    if (pendingData.inviteCode) inviteCode = pendingData.inviteCode;
                                    if (pendingData.name) customName = pendingData.name;
                                }
                            } catch (e) {}
                            localStorage.removeItem('azre_pending_signup');
                        }

                        // Create new user if not exists based on Google info
                        const newUserPartial: any = {
                            id: session.user.id,
                            name: customName,
                            email: email || '',
                            photo: session.user.user_metadata?.avatar_url,
                            position: 'Acquisitions',
                            createdAt: new Date().toISOString(),
                            loginStatus: 'Logged In',
                            organization: orgName,
                            organization_id: orgId
                        };
                        user = await api.save(newUserPartial, 'Users');

                        if (isNewOrg) {
                            try {
                                await api.save({
                                    id: generateId(),
                                    organization: orgName,
                                    organization_id: orgId,
                                    inviteCode: inviteCode
                                }, 'Integrations');
                            } catch (e) {
                                console.error("Failed to save integration for new org", e);
                            }
                        }
                    } else {
                        // Update existing user login status
                        const updatedUser = { 
                            ...user, 
                            loginStatus: 'Logged In',
                            photo: user.photo || session.user.user_metadata.avatar_url 
                        } as UserType;
                        user = await api.save(updatedUser, 'Users');
                    }
                    
                    if (user && user.organization) {
                        try {
                            const ints = await api.load('Integrations');
                            const orgConfig = ints.find((i: any) => {
                                let o = i.organization;
                                if (typeof o === 'string' && o.startsWith('"') && o.endsWith('"')) o = o.slice(1, -1);
                                return o === user!.organization;
                            });
                            if (orgConfig && orgConfig.supabaseUrl && orgConfig.supabaseKey) {
                                // Only legacy logic calls updateSupabaseClient, which is removed natively.
                            }
                        } catch (e) {
                            console.error("Failed to load organization supabase config on Google login", e);
                        }
                    }

                    if (user) {
                        localStorage.setItem('azre-last-user', JSON.stringify({ name: user.name, email: user.email }));
                        onLogin(user);
                    }
                }
            } catch (err: any) {
                console.error("Google Auth Sync Error:", err);
            } finally {
                setLoading(false);
            }
        };
        
        // Only run check if we aren't already manually loading
        if (!loadingRef.current) checkSession();

        // Listen for auth state changes (e.g. from the popup resolving the oauth flow)
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                if (window.opener) {
                    window.close();
                } else if (!loadingRef.current) {
                    checkSession();
                }
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleSwitchAccount = () => {
        setUseCachedUser(false);
        setFormData(prev => ({ ...prev, email: '', password: '' }));
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        
        try {
            const redirectUrl = window.location.origin + window.location.pathname;

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true, // IMPORTANT FOR IFRAME COMPATIBILITY! Let's handle via popup.
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) throw error;
            
            if (data?.url) {
                const popup = window.open(data.url, 'oauth_popup', 'width=600,height=700');
                if (!popup) {
                    throw new Error("Popup blocked by browser. Please allow popups to sign in with Google.");
                }
                
                // Clear loading state after popup opens so the UI isn't stuck forever
                setLoading(false);
            } else {
                throw new Error("Unable to retrieve Google OAuth URL.");
            }
        } catch (err: any) {
            console.error("Google Login Error:", err);
            setError(err.message || "Failed to initiate Google Login.");
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignup) {
                // 1. Validation
                if (formData.password !== formData.confirmPassword) {
                    throw new Error("Passwords do not match");
                }
                
                let orgName = '';
                if (formData.organizationAction === 'create') {
                    if (!formData.organizationName) throw new Error("Organization Name is required");
                    orgName = formData.organizationName;
                } else {
                    orgName = formData.selectedOrganization;
                    if (!orgName) throw new Error("Please select an organization to join");
                    // Note: Invite code check deferred or basic fallback because of unauthenticated read limitation
                    if (formData.inviteCode.toLowerCase() !== 'zakar') {
                        // Keep simple fallback check pre-auth
                    }
                }

                // 2. Perform Supabase Sign Up 
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: { 
                        data: { 
                            full_name: formData.name,
                            pending_org_action: formData.organizationAction,
                            pending_org_name: orgName,
                            pending_invite_code: formData.inviteCode
                        },
                        emailRedirectTo: window.location.origin
                    }
                });

                if (authError) throw new Error(authError.message);
                if (!authData.user) throw new Error("Sign up failed, no user returned.");

                // Save pending organization creation info to localStorage ALWAYS for signup
                // so that when checkSession() fires (either immediately on return, or after email confirm),
                // it picks it up and processes it exactly once.
                let targetOrgId = '';
                let isNewOrg = false;
                if (formData.organizationAction === 'create') {
                    targetOrgId = 'org_' + formData.organizationName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 7);
                    isNewOrg = true;
                } else {
                    // Try to look up joined org id
                    try {
                        const ints = await api.load('Integrations');
                        const joinedOrgIntegration = ints.find((i: any) => {
                            let o = i.organization;
                            if (typeof o === 'string' && o.startsWith('"') && o.endsWith('"')) o = o.slice(1, -1);
                            return o === orgName;
                        });
                        
                        let integrationInvite = joinedOrgIntegration?.inviteCode;
                        if (typeof integrationInvite === 'string' && integrationInvite.startsWith('"') && integrationInvite.endsWith('"')) {
                            integrationInvite = integrationInvite.slice(1, -1);
                        }
                        if (integrationInvite && formData.inviteCode !== integrationInvite) {
                             throw new Error("Invalid Invite Code for this organization");
                        }

                        if (joinedOrgIntegration && joinedOrgIntegration.organization_id) {
                            targetOrgId = joinedOrgIntegration.organization_id;
                        }
                    } catch (e: any) {
                         console.error("Failed to load existing integration credentials", e);
                         if (e.message.includes("Invalid Invite Code")) throw e;
                    }
                }

                if (!targetOrgId) {
                    targetOrgId = 'org_' + Math.random().toString(36).substring(2, 7);
                    isNewOrg = true;
                }

                localStorage.setItem('azre_pending_signup', JSON.stringify({
                    email: formData.email,
                    organizationName: orgName,
                    organizationId: targetOrgId,
                    isNew: isNewOrg,
                    inviteCode: formData.inviteCode,
                    name: formData.name
                }));

                // If email confirmation is enabled, session won't exist
                if (!authData.session) {
                     setSuccessMsg("Registration successful! Please check your email to confirm your account before logging in. (If you don't receive an email, go to Supabase Dashboard > Authentication > Providers > Email and turn OFF 'Confirm email')");
                     setLoading(false);
                     return;
                }

                // If session is returned immediately (email confirmations off),
                // DO NOTHING FURTHER! The onAuthStateChange listener has already caught the SIGNED_IN event,
                // and it is going to call checkSession() which will read azre_pending_signup, build the user,
                // save it, and log the user in!
            } else {
                // LOGIN
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password
                });

                if (authError) throw new Error("Invalid email or password");
                if (!authData.user) throw new Error("Sign in failed");

                // Get User Record matching UUID (or fallback to email)
                let { data: userData, error: dbError } = await supabase.from('Users').select('*').eq('id', authData.user.id).single();

                if (dbError || !userData) {
                    console.log("No explicit User record found by ID, checking by email.");
                    const { data: userByEmail, error: emailError } = await supabase.from('Users').select('*').eq('email', formData.email).single();
                    if (!emailError && userByEmail) {
                        userData = userByEmail;
                        dbError = null;
                    }
                }

                let updatedUser: any;

                if (dbError || !userData) {
                    console.error("No explicit User record found, trying to fallback.", dbError);
                    // Check local pending user
                    const pendingUserStr = localStorage.getItem('azre-pending-user');
                    if (pendingUserStr) {
                         const pendingUser = JSON.parse(pendingUserStr);
                         if (pendingUser.email === formData.email) {
                             updatedUser = pendingUser;
                         }
                    }
                    if (!updatedUser) {
                        console.warn("User database record missing, recreating...");
                        
                        // Check if we saved a pending signup organization request
                        const pendingOrgJson = localStorage.getItem('azre_pending_signup');
                        let orgName = authData?.user?.user_metadata?.pending_org_name || 'My Organization';
                        let orgId = '';
                        let isNewOrg = false;
                        let inviteCode = authData?.user?.user_metadata?.pending_invite_code || '';
                        
                        if (pendingOrgJson) {
                            try {
                                const pendingData = JSON.parse(pendingOrgJson);
                                if (pendingData.email === formData.email) {
                                    orgName = pendingData.organizationName || orgName;
                                    orgId = pendingData.organizationId || orgId;
                                    isNewOrg = pendingData.isNew;
                                    inviteCode = pendingData.inviteCode || inviteCode;
                                }
                            } catch (e) {}
                            localStorage.removeItem('azre_pending_signup');
                        }

                        // Try fixing missing orgId using user_metadata
                        if (!orgId) {
                            if (authData?.user?.user_metadata?.pending_org_action === 'create') {
                                orgId = 'org_' + orgName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 7);
                                isNewOrg = true;
                            } else if (authData?.user?.user_metadata?.pending_org_action === 'join') {
                                try {
                                    const ints = await api.load('Integrations');
                                    const joinedOrg = ints.find((i: any) => {
                                        let o = i.organization;
                                        if (typeof o === 'string' && o.startsWith('"') && o.endsWith('"')) o = o.slice(1, -1);
                                        return o === orgName;
                                    });
                                    if (joinedOrg && joinedOrg.organization_id) {
                                        orgId = joinedOrg.organization_id;
                                    }
                                } catch (e) {
                                    console.error("Failed to load integrations for join fallback", e);
                                }
                            }
                            if (!orgId) {
                                // Default fallback: isolate the user into their own new random organization instead of AZRE
                                orgId = 'org_' + Math.random().toString(36).substring(2, 7);
                                isNewOrg = true;
                            }
                        }

                        const newUserPartial = {
                            id: authData.user.id,
                            name: formData.email?.split('@')[0] || 'Unknown User',
                            email: formData.email,
                            position: 'Acquisitions',
                            createdAt: new Date().toISOString(),
                            loginStatus: 'Logged In',
                            organization: orgName,
                            organization_id: orgId
                        };
                        updatedUser = await api.save(newUserPartial, 'Users');

                        if (isNewOrg && updatedUser) {
                            try {
                                await api.save({
                                    id: 'int_' + Math.random().toString(36).substring(2, 9),
                                    organization: orgName,
                                    organization_id: orgId,
                                    inviteCode: inviteCode || 'azre-invite'
                                }, 'Integrations');
                            } catch (e) {
                                console.error("Failed to save integration for new org", e);
                            }
                        }

                        if (!updatedUser) {
                            throw new Error("Your account authenticated, but we failed to recreate your missing database record. Please contact support.");
                        }
                    }
                } else {
                    updatedUser = { ...userData, loginStatus: 'Logged In' };
                }
                
                if (updatedUser.organization_id) {
                    setOrganizationId(updatedUser.organization_id);
                }

                await api.save(updatedUser, 'Users');
                localStorage.setItem('azre-last-user', JSON.stringify({ name: updatedUser.name, email: updatedUser.email }));
                onLogin(updatedUser);
            }
        } catch (err: any) {
            console.error(err);
            if (err.message === 'Failed to fetch') {
                setError('Failed to connect. Please ensure your Supabase URL and Anon Key are correct in settings.');
            } else if (err.code === '23505' || err.message?.includes('duplicate key value violates unique constraint')) {
                setError('An account with this email already exists.');
            } else {
                setError(err.message || 'An error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 font-sans transition-colors duration-300">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-block p-4">
                        <h1 className="text-5xl font-light tracking-tight text-gray-900 dark:text-white mb-0">ASHARI</h1>
                        <h1 className="text-5xl font-light tracking-tight text-blue-600 dark:text-[#4ADE80] mb-1">ZAKAR</h1>
                        <div className="text-justify flex justify-between w-full text-gray-600 dark:text-white tracking-[0.35em] text-sm mt-2">
                            <span>R</span><span>E</span><span>A</span><span>L</span>
                            <span className="w-4"></span>
                            <span>E</span><span>S</span><span>T</span><span>A</span><span>T</span><span>E</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 shadow-2xl transition-all duration-300">
                    {successMsg ? (
                        <div className="text-center py-6">
                            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-[#4ADE80] rounded-full flex items-center justify-center mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check Your Email</h2>
                            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                                {successMsg}
                            </p>
                            <button
                                onClick={() => { setSuccessMsg(''); setIsSignup(false); }}
                                className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-[#4ADE80] dark:hover:bg-[#3bc970] text-white dark:text-gray-900 font-bold py-3 rounded transition-all"
                            >
                                Return to Log In
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                                {isSignup ? 'Create Account' : (useCachedUser && cachedUser && !isSignup ? `Welcome Back, ${cachedUser.name.split(' ')[0]}` : 'Welcome Back')}
                            </h2>
                            
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded mb-4 text-sm flex items-center gap-2">
                                    <AlertTriangle size={16}/> {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignup && (
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Full Name</label>
                                <input required autoComplete="name" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-[#4ADE80] outline-none transition-colors" placeholder="John Doe" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                        )}
                        
                        {!isSignup && useCachedUser && cachedUser ? (
                            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded p-3 flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-200 dark:bg-gray-700 p-1.5 rounded-full"><User size={16} className="text-gray-500 dark:text-gray-400"/></div>
                                    <div>
                                        <div className="text-gray-900 dark:text-white text-sm font-medium">{cachedUser.name}</div>
                                        <div className="text-xs text-gray-500">{cachedUser.email}</div>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={handleSwitchAccount}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 hover:underline"
                                >
                                    Change?
                                </button>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Email Address</label>
                                <input required type="email" autoComplete="email" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-[#4ADE80] outline-none transition-colors" placeholder="name@example.com" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Password</label>
                            <input required type="password" autoComplete={isSignup ? "new-password" : "current-password"} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-[#4ADE80] outline-none transition-colors" placeholder="••••••••" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>

                        {isSignup && (
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Confirm Password</label>
                                <input required type="password" autoComplete="new-password" className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-[#4ADE80] outline-none transition-colors" placeholder="••••••••" value={formData.confirmPassword || ''} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                            </div>
                        )}

                        {isSignup && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Organization Setup</label>
                                    <div className="flex gap-2">
                                        <button 
                                            type="button"
                                            className={`flex-1 py-2 text-sm font-medium rounded ${formData.organizationAction === 'join' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-[#4ADE80] border border-blue-500 dark:border-[#4ADE80]' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-transparent'}`}
                                            onClick={() => setFormData({...formData, organizationAction: 'join'})}
                                        >
                                            Join Existing
                                        </button>
                                        <button 
                                            type="button"
                                            className={`flex-1 py-2 text-sm font-medium rounded ${formData.organizationAction === 'create' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-[#4ADE80] border border-blue-500 dark:border-[#4ADE80]' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border border-transparent'}`}
                                            onClick={() => setFormData({...formData, organizationAction: 'create'})}
                                        >
                                            Create New
                                        </button>
                                    </div>
                                </div>
                                
                                {formData.organizationAction === 'join' && (
                                    <div>
                                        <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Select Organization</label>
                                        <select 
                                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-[#4ADE80] outline-none transition-colors"
                                            value={formData.selectedOrganization}
                                            onChange={e => setFormData({...formData, selectedOrganization: e.target.value})}
                                            required
                                        >
                                            <option value="" disabled>Select an organization</option>
                                            {organizations.map(org => (
                                                <option key={org} value={org}>{org}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                
                                {formData.organizationAction === 'create' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Organization Name</label>
                                            <input required className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 text-gray-900 dark:text-white focus:border-blue-500 dark:focus:border-[#4ADE80] outline-none transition-colors" placeholder="e.g. AZRE" value={formData.organizationName || ''} onChange={e => setFormData({...formData, organizationName: e.target.value})} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isSignup && (
                            <div>
                                <label className="block text-xs text-blue-600 dark:text-[#4ADE80] uppercase font-bold mb-1 flex justify-between">
                                    <span>{formData.organizationAction === 'create' ? 'Set Invite Code' : 'Join Invite Code'}</span>
                                </label>
                                <input required className="w-full bg-gray-50 dark:bg-gray-900 border border-blue-500 dark:border-[#4ADE80] rounded p-3 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 dark:focus:ring-[#4ADE80] outline-none transition-colors" placeholder="Enter code..." value={formData.inviteCode || ''} onChange={e => setFormData({...formData, inviteCode: e.target.value})} />
                                {formData.organizationAction === 'create' && (
                                    <p className="text-xs text-gray-500 mt-1">This code will be required for others to join.</p>
                                )}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-[#4ADE80] dark:hover:bg-[#3bc970] text-white dark:text-gray-900 font-bold py-3 rounded mt-4 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin"/>}
                            {isSignup ? 'Sign Up' : 'Log In'}
                        </button>
                    </form>

                    {!isSignup && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Or continue with</span>
                                </div>
                            </div>

                            <button 
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full bg-white dark:bg-gray-700 text-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 font-bold py-3 rounded transition-all transform hover:scale-[1.02] hover:bg-gray-50 dark:hover:bg-gray-600 flex justify-center items-center gap-2"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                Google
                            </button>
                        </>
                    )}

                    <div className="mt-6 text-center space-y-2">
                        {!isSignup && useCachedUser && (
                             <div className="text-xs text-gray-500">
                                Not {cachedUser?.name}? <button onClick={handleSwitchAccount} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white underline">Switch account</button>
                             </div>
                        )}
                        <button 
                            onClick={() => { setIsSignup(!isSignup); setError(''); setSuccessMsg(''); setFormData({ name: '', email: '', password: '', confirmPassword: '', inviteCode: '', organizationAction: 'join', organizationName: '', selectedOrganization: organizations[0] || 'AZRE', supabaseUrl: '', supabaseKey: ''}); setUseCachedUser(false); }}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                        </button>
                    </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
