import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import LanguageSelector from '../components/LanguageSelector';

const Login = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ kullaniciAdi: '', sifre: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await axios.post('/api/auth/login', formData);
            if (response.data.success) {
                localStorage.setItem('authToken', response.data.token);
                localStorage.setItem('kullanici', JSON.stringify(response.data.kullanici));
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Shapes */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-10 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-300 opacity-10 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>

            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative z-10 animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                    <div></div>
                    <LanguageSelector />
                </div>

                <div className="text-center mb-8">
                    <div className="w-20 h-20 gradient-bg rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
                        <User className="w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('app.title')}</h1>
                    <p className="text-gray-600">{t('login.welcome')}</p>
                </div>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('login.username')}
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder={t('login.username_placeholder')}
                                value={formData.kullaniciAdi}
                                onChange={(e) => setFormData({ ...formData, kullaniciAdi: e.target.value })}
                                required
                            />
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('login.password')}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                placeholder={t('login.password_placeholder')}
                                value={formData.sifre}
                                onChange={(e) => setFormData({ ...formData, sifre: e.target.value })}
                                required
                            />
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500" />
                            <span className="ml-2 text-sm text-gray-700">{t('login.remember_me')}</span>
                        </label>
                        <a href="#" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                            {t('login.forgot_password')}
                        </a>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full gradient-bg text-white py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-70"
                    >
                        {loading ? t('login.submitting') : t('login.submit')}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default Login;
