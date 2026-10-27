import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
    LayoutDashboard, Package, FileText, Settings, LogOut,
    Bell, Search, Plus, Filter, Download,
    TrendingUp, TrendingDown, DollarSign, CheckCircle,
    AlertCircle, Clock, XCircle, ChevronDown, User, Calendar,
    MoreVertical, Edit, Trash2, Eye
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { KalipModal, DetailModal, DenemeEkleModal, RevizyonEkleModal, BakimEkleModal } from '../components/Modals';

// --- UI Helper Components ---
const StatusBadge = ({ status, t }) => {
    const styles = {
        aktif: 'bg-green-100 text-green-700',
        active: 'bg-green-100 text-green-700',
        revizyon: 'bg-orange-100 text-orange-700',
        revision: 'bg-orange-100 text-orange-700',
        deneme: 'bg-blue-100 text-blue-700',
        trial: 'bg-blue-100 text-blue-700',
        pasif: 'bg-gray-100 text-gray-700',
        passive: 'bg-gray-100 text-gray-700'
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status?.toLowerCase()] || styles.pasif}`}>
            {t ? t(`dashboard.status.${status?.toLowerCase()}`) : status}
        </span>
    );
};

const StatCard = ({ title, value, change, icon, color, subtitle }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100">
        <div className="flex items-center justify-between">
            <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900 mb-1">{value}</h3>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                {change !== undefined && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                        <TrendingUp size={16} />
                        <span>{Math.abs(change)}%</span>
                    </div>
                )}
            </div>
            <div className={`${color} p-4 rounded-xl shadow-lg transform transition-transform hover:scale-110`}>
                {icon}
            </div>
        </div>
    </div>
);

const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [kaliplar, setKaliplar] = useState([]);
    const [stats, setStats] = useState({
        toplamMaliyet: 0,
        aktifKaliplar: 0,
        revizyonBekleyen: 0,
        toplamDeneme: 0,
        toplamRevizyon: 0,
        revizyonMaliyeti: 0
    });

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [durumFilter, setDurumFilter] = useState('hepsi');
    const [selectedKalip, setSelectedKalip] = useState(null);

    // Modal States
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isDenemeModalOpen, setIsDenemeModalOpen] = useState(false);
    const [isRevizyonModalOpen, setIsRevizyonModalOpen] = useState(false);
    const [isBakimModalOpen, setIsBakimModalOpen] = useState(false);

    const user = JSON.parse(localStorage.getItem('kullanici') || '{}');
    const token = localStorage.getItem('authToken');

    const refreshData = async () => {
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            setLoading(true);
            const response = await axios.get('/api/kaliplar', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setKaliplar(response.data);
            calculateStats(response.data);
        } catch (err) {
            console.error('Data refresh error:', err);
            if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [navigate, token]);

    const calculateStats = (data) => {
        if (!Array.isArray(data)) return;

        const toplamMaliyet = data.reduce((sum, k) => sum + (parseFloat(k.maliyet) || 0), 0);
        const aktifKaliplar = data.filter(k => k.durum === 'aktif').length;
        const revizyonBekleyen = data.filter(k => k.durum === 'revizyon').length;

        let toplamDeneme = 0;
        let toplamRevizyon = 0;
        let revizyonMaliyeti = 0;

        data.forEach(k => {
            if (k.denemeler) toplamDeneme += k.denemeler.length;
            if (k.revizyonlar) {
                toplamRevizyon += k.revizyonlar.length;
                revizyonMaliyeti += k.revizyonlar.reduce((s, r) => s + (parseFloat(r.fiyat) || 0), 0);
            }
        });

        setStats({
            toplamMaliyet,
            aktifKaliplar,
            revizyonBekleyen,
            toplamDeneme,
            toplamRevizyon,
            revizyonMaliyeti
        });
    };

    // --- Action Handlers ---

    const handleSaveKalip = async (data) => {
        try {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            if (selectedKalip && isEditModalOpen) {
                await axios.put(`/api/kaliplar/${selectedKalip.id}`, data, config);
            } else {
                await axios.post('/api/kaliplar', data, config);
            }
            refreshData();
            setIsNewModalOpen(false);
            setIsEditModalOpen(false);
        } catch (err) {
            console.error(err);
            alert(t('common.error') + ': ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('common.confirm_delete'))) return;
        try {
            await axios.delete(`/api/kaliplar/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            refreshData();
        } catch (err) {
            console.error(err);
            alert(t('common.error'));
        }
    };

    const handleSubProcess = async (endpoint, data, modalSetter) => {
        try {
            await axios.post(endpoint, { ...data, kalipId: selectedKalip.id }, { headers: { Authorization: `Bearer ${token}` } });
            // Update local state and selectedKalip without full reload for smoother UX, but full reload ensures consistency
            await refreshData();
            modalSetter(false);
            // Re-select proper selectedKalip from updated list if needed, or close details.
            // We will close the sub-modal and likely the user will view details again.
            // But selectedKalip is stale. We need to update it.
            // Since refreshData updates kaliplar, we can find it there.
            // HOWEVER, refreshData is async and state update is batched.
            // Better to fetch fresh list here and update selectedKalip immediately.
            const response = await axios.get('/api/kaliplar', { headers: { Authorization: `Bearer ${token}` } });
            const updated = response.data.find(k => k.id === selectedKalip.id);
            setSelectedKalip(updated);
            setIsDetailModalOpen(true); // Re-open details
        } catch (err) {
            console.error(err);
            alert(t('common.error') + ': ' + (err.response?.data?.error || err.message));
        }
    }

    const filteredKaliplar = useMemo(() => {
        if (!Array.isArray(kaliplar)) return [];
        return kaliplar.filter(k => {
            const matchSearch = k.ad?.toLowerCase().includes(searchTerm.toLowerCase()) || k.kod?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchFilter = durumFilter === 'hepsi' || k.durum === durumFilter;
            return matchSearch && matchFilter;
        });
    }, [kaliplar, searchTerm, durumFilter]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">{t('common.loading')}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 hidden lg:flex flex-col fixed h-full z-10">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center text-white">
                            <Package className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-gray-800">KalıpTakip</span>
                    </div>
                    <nav className="space-y-1">
                        <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                            <LayoutDashboard size={20} /> {t('dashboard.title').split(' ')[0]}
                        </button>
                        <button onClick={() => setActiveTab('kaliplar')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'kaliplar' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                            <Package size={20} /> {t('dashboard.stats.total_molds')}
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"><FileText size={20} /> Raporlar</button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"><Settings size={20} /> Ayarlar</button>
                    </nav>
                </div>
                <div className="mt-auto p-6 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                            {user.adSoyad?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.adSoyad}</p>
                            <p className="text-xs text-gray-500 truncate">{user.rol}</p>
                        </div>
                    </div>
                    <button onClick={() => { localStorage.removeItem('authToken'); navigate('/login'); }} className="mt-4 flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 p-2 rounded-lg w-full transition-colors">
                        <LogOut size={16} /> {t('dashboard.logout')}
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-x-hidden overflow-y-auto lg:ml-64">
                <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-8 py-4 flex items-center justify-between shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800">{t('dashboard.welcome')}, {user.adSoyad}</h2>
                    <div className="flex gap-4"><LanguageSelector /></div>
                </header>

                <div className="p-8 space-y-6">
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Dashboard Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard title={t('dashboard.stats.total_molds')} value={kaliplar.length} color="bg-blue-500" icon={<Package className="text-white" />} />
                                <StatCard title={t('dashboard.stats.active_molds')} value={stats.aktifKaliplar} color="bg-green-500" icon={<CheckCircle className="text-white" />} />
                                <StatCard title={t('dashboard.stats.pending_revision')} value={stats.revizyonBekleyen} color="bg-orange-500" icon={<AlertCircle className="text-white" />} />
                                <StatCard title={t('dashboard.stats.total_cost')} value={`₺${(stats.toplamMaliyet / 1000).toFixed(0)}K`} color="bg-purple-500" icon={<DollarSign className="text-white" />} />
                            </div>

                            {/* Charts & Deadlines */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg"><Calendar size={18} /> {t('dashboard.deadlines.title')}</h3>
                                    <div className="space-y-2">
                                        {kaliplar.filter(k => new Date(k.termin) > new Date()).sort((a, b) => new Date(a.termin) - new Date(b.termin)).slice(0, 5).map(k => (
                                            <div key={k.id} className="flex justify-between items-center py-3 px-3 hover:bg-red-50 rounded-lg border-l-4 border-red-500 bg-white shadow-sm transition-all">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">{k.ad}</p>
                                                    <p className="text-xs text-gray-500">{k.kod}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-red-600">{new Date(k.termin).toLocaleDateString()}</p>
                                                    <p className="text-xs text-red-400">Acil</p>
                                                </div>
                                            </div>
                                        ))}
                                        {kaliplar.length === 0 && <p className="text-gray-500 italic text-center py-4">{t('table.empty')}</p>}
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg"><FileText size={18} /> {t('dashboard.activities.title')}</h3>
                                    <div className="space-y-3">
                                        {/* Activity Stream Mockup based on recent edits if any, or general info */}
                                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                            <div className="p-2 bg-blue-100 rounded-full text-blue-600"><Clock size={16} /></div>
                                            <div>
                                                <p className="text-sm font-medium">Sistem Başlatıldı</p>
                                                <p className="text-xs text-gray-500">Kullanıcı girişi yapıldı</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'kaliplar' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm gap-4">
                                <div className="flex gap-4 flex-1 w-full md:w-auto">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder={t('table.search_placeholder')}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="border border-gray-200 rounded-lg px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        value={durumFilter}
                                        onChange={(e) => setDurumFilter(e.target.value)}
                                    >
                                        <option value="hepsi">{t('table.all')}</option>
                                        <option value="aktif">{t('dashboard.status.active')}</option>
                                        <option value="deneme">{t('dashboard.status.trial')}</option>
                                        <option value="revizyon">{t('dashboard.status.revision')}</option>
                                    </select>
                                </div>
                                <button
                                    onClick={() => { setSelectedKalip(null); setIsNewModalOpen(true); }}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <Plus className="w-5 h-5" />
                                    {t('buttons.new_mold')}
                                </button>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">{t('table.code')}</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">{t('table.name')}</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">{t('table.status')}</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">{t('table.supplier')}</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">{t('table.deadline')}</th>
                                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">{t('table.actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredKaliplar.length > 0 ? filteredKaliplar.map((kalip) => (
                                                <tr key={kalip.id} className="hover:bg-purple-50 transition-colors group">
                                                    <td className="px-6 py-4 font-mono text-sm text-purple-600 font-medium">{kalip.kod}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-gray-900">{kalip.ad}</div>
                                                        <div className="text-xs text-gray-500">{kalip.proje}</div>
                                                    </td>
                                                    <td className="px-6 py-4"><StatusBadge status={kalip.durum} t={t} /></td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{kalip.tedarikci}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(kalip.termin).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { setSelectedKalip(kalip); setIsDetailModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title={t('buttons.details')}><Eye className="w-4 h-4" /></button>
                                                            <button onClick={() => { setSelectedKalip(kalip); setIsEditModalOpen(true); }} className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors" title={t('buttons.edit')}><Edit className="w-4 h-4" /></button>
                                                            <button onClick={() => handleDelete(kalip.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title={t('buttons.delete')}><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                                        <p>{t('table.empty')}</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modals */}
            <KalipModal
                isOpen={isNewModalOpen || isEditModalOpen}
                onClose={() => { setIsNewModalOpen(false); setIsEditModalOpen(false); setSelectedKalip(null); }}
                onSave={handleSaveKalip}
                initialData={isEditModalOpen ? selectedKalip : null}
            />

            <DetailModal
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                kalip={selectedKalip}
                onAddDeneme={() => { setIsDetailModalOpen(false); setIsDenemeModalOpen(true); }}
                onAddRevizyon={() => { setIsDetailModalOpen(false); setIsRevizyonModalOpen(true); }}
                onAddBakim={() => { setIsDetailModalOpen(false); setIsBakimModalOpen(true); }}
            />

            <DenemeEkleModal isOpen={isDenemeModalOpen} onClose={() => setIsDenemeModalOpen(false)} onSave={(data) => handleSubProcess('/api/deneme', data, setIsDenemeModalOpen)} />
            <RevizyonEkleModal isOpen={isRevizyonModalOpen} onClose={() => setIsRevizyonModalOpen(false)} onSave={(data) => handleSubProcess('/api/revizyon', data, setIsRevizyonModalOpen)} />
            <BakimEkleModal isOpen={isBakimModalOpen} onClose={() => setIsBakimModalOpen(false)} onSave={(data) => handleSubProcess('/api/bakim', data, setIsBakimModalOpen)} />
        </div>
    );
};



export default Dashboard;
