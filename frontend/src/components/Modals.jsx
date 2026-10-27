import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Plus, Trash2, Calendar, FileText, Activity, AlertCircle, Tool } from 'lucide-react';

// --- UI Components ---
const Input = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            {...props}
        />
    </div>
);

const Select = ({ label, children, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all bg-white"
            {...props}
        >
            {children}
        </select>
    </div>
);

const Button = ({ children, variant = 'primary', size = 'md', icon, ...props }) => {
    const base = "font-medium rounded-lg transition-all flex items-center justify-center gap-2";
    const variants = {
        primary: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:-translate-y-0.5",
        secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
        danger: "bg-red-50 text-red-600 hover:bg-red-100"
    };
    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm"
    };

    return (
        <button className={`${base} ${variants[variant]} ${sizes[size]}`} {...props}>
            {icon}
            {children}
        </button>
    );
};

const InfoRow = ({ label, value }) => (
    <div className="flex justify-between border-b border-gray-50 pb-2">
        <span className="text-gray-500 text-sm">{label}</span>
        <span className="font-medium text-gray-900 text-sm">{value || '-'}</span>
    </div>
);

const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
                {children}
            </div>
        </div>
    </div>
);

export const KalipModal = ({ isOpen, onClose, onSave, initialData }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        kod: '', ad: '', proje: '', durum: 'deneme', tedarikci: '', gozSayisi: 1,
        malzeme: '', olusturmaTarihi: new Date().toISOString().split('T')[0], termin: '',
        maliyet: 0, odemeDurumu: 'Ödenmedi', notlar: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                termin: initialData.termin ? initialData.termin.split('T')[0] : '',
                olusturmaTarihi: initialData.olusturmaTarihi ? initialData.olusturmaTarihi.split('T')[0] : ''
            });
        } else {
            setFormData({
                kod: '', ad: '', proje: '', durum: 'deneme', tedarikci: '', gozSayisi: 1,
                malzeme: '', olusturmaTarihi: new Date().toISOString().split('T')[0], termin: '',
                maliyet: 0, odemeDurumu: 'Ödenmedi', notlar: ''
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Modal title={initialData ? t('modals.edit_mold_title') : t('modals.new_mold_title')} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.code')} value={formData.kod} onChange={e => setFormData({ ...formData, kod: e.target.value })} required />
                    <Input label={t('modals.form.name')} value={formData.ad} onChange={e => setFormData({ ...formData, ad: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.project')} value={formData.proje} onChange={e => setFormData({ ...formData, proje: e.target.value })} />
                    <Select label={t('table.status')} value={formData.durum} onChange={e => setFormData({ ...formData, durum: e.target.value })}>
                        <option value="aktif">Aktif</option>
                        <option value="revizyon">Revizyon</option>
                        <option value="deneme">Deneme</option>
                        <option value="pasif">Pasif</option>
                    </Select>
                </div>
                <Input label={t('modals.form.supplier')} value={formData.tedarikci} onChange={e => setFormData({ ...formData, tedarikci: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.cavity')} type="number" value={formData.gozSayisi} onChange={e => setFormData({ ...formData, gozSayisi: e.target.value })} />
                    <Input label={t('modals.form.material')} value={formData.malzeme} onChange={e => setFormData({ ...formData, malzeme: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.deadline')} type="date" value={formData.termin} onChange={e => setFormData({ ...formData, termin: e.target.value })} required />
                    <Input label={t('modals.form.cost')} type="number" value={formData.maliyet} onChange={e => setFormData({ ...formData, maliyet: e.target.value })} />
                </div>
                <div>
                    <Input label={t('modals.form.payment')} value={formData.odemeDurumu} onChange={e => setFormData({ ...formData, odemeDurumu: e.target.value })} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals.form.notes')}</label>
                    <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        rows="3"
                        value={formData.notlar}
                        onChange={e => setFormData({ ...formData, notlar: e.target.value })}
                    ></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={onClose} type="button">{t('buttons.cancel')}</Button>
                    <Button type="submit">{t('buttons.save')}</Button>
                </div>
            </form>
        </Modal>
    );
};

export const DenemeEkleModal = ({ isOpen, onClose, onSave }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        tarih: new Date().toISOString().split('T')[0],
        hammadde: '', renk: '', adet: 0, sonuc: '', operator: ''
    });
    if (!isOpen) return null;
    return (
        <Modal title={t('modals.add_trial_title')} onClose={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
                <Input label={t('modals.form.date')} type="date" value={formData.tarih} onChange={e => setFormData({ ...formData, tarih: e.target.value })} required />
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.raw_material')} value={formData.hammadde} onChange={e => setFormData({ ...formData, hammadde: e.target.value })} />
                    <Input label={t('modals.form.color')} value={formData.renk} onChange={e => setFormData({ ...formData, renk: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.quantity')} type="number" value={formData.adet} onChange={e => setFormData({ ...formData, adet: e.target.value })} />
                    <Input label={t('modals.form.operator')} value={formData.operator} onChange={e => setFormData({ ...formData, operator: e.target.value })} />
                </div>
                <Input label={t('modals.form.result')} value={formData.sonuc} onChange={e => setFormData({ ...formData, sonuc: e.target.value })} required placeholder="Örn: Onaylandı, Revizyon Gerekli..." />
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={onClose} type="button">{t('buttons.cancel')}</Button>
                    <Button type="submit">{t('buttons.save')}</Button>
                </div>
            </form>
        </Modal>
    );
};

export const RevizyonEkleModal = ({ isOpen, onClose, onSave }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        tarih: new Date().toISOString().split('T')[0],
        firma: '', islem: '', fiyat: 0, odemeDurumu: '', aciklama: ''
    });
    if (!isOpen) return null;
    return (
        <Modal title={t('modals.add_revision_title')} onClose={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
                <Input label={t('modals.form.date')} type="date" value={formData.tarih} onChange={e => setFormData({ ...formData, tarih: e.target.value })} required />
                <Input label={t('modals.form.company')} value={formData.firma} onChange={e => setFormData({ ...formData, firma: e.target.value })} />
                <Input label={t('modals.form.process')} value={formData.islem} onChange={e => setFormData({ ...formData, islem: e.target.value })} required />
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('modals.form.price')} type="number" value={formData.fiyat} onChange={e => setFormData({ ...formData, fiyat: e.target.value })} />
                    <Input label={t('modals.form.payment')} value={formData.odemeDurumu} onChange={e => setFormData({ ...formData, odemeDurumu: e.target.value })} />
                </div>
                <Input label={t('modals.form.description')} value={formData.aciklama} onChange={e => setFormData({ ...formData, aciklama: e.target.value })} />
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={onClose} type="button">{t('buttons.cancel')}</Button>
                    <Button type="submit">{t('buttons.save')}</Button>
                </div>
            </form>
        </Modal>
    );
};

export const BakimEkleModal = ({ isOpen, onClose, onSave }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        tarih: new Date().toISOString().split('T')[0],
        islem: '', sorumlu: '', durum: 'Tamamlandı'
    });
    if (!isOpen) return null;
    return (
        <Modal title={t('modals.add_maintenance_title')} onClose={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-4">
                <Input label={t('modals.form.date')} type="date" value={formData.tarih} onChange={e => setFormData({ ...formData, tarih: e.target.value })} required />
                <Input label={t('modals.form.process')} value={formData.islem} onChange={e => setFormData({ ...formData, islem: e.target.value })} required />
                <Input label={t('modals.form.responsible')} value={formData.sorumlu} onChange={e => setFormData({ ...formData, sorumlu: e.target.value })} />
                <Select label={t('modals.form.status')} value={formData.durum} onChange={e => setFormData({ ...formData, durum: e.target.value })}>
                    <option value="Tamamlandı">Tamamlandı</option>
                    <option value="Devam Ediyor">Devam Ediyor</option>
                    <option value="Planlandı">Planlandı</option>
                </Select>
                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={onClose} type="button">{t('buttons.cancel')}</Button>
                    <Button type="submit">{t('buttons.save')}</Button>
                </div>
            </form>
        </Modal>
    );
};


export const DetailModal = ({ isOpen, onClose, kalip, onAddDeneme, onAddRevizyon, onAddBakim }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('info');

    if (!isOpen || !kalip) return null;

    const tabs = [
        { id: 'info', label: t('modals.tabs.info'), icon: <FileText size={18} /> },
        { id: 'trials', label: t('modals.tabs.trials'), icon: <Activity size={18} /> },
        { id: 'revisions', label: t('modals.tabs.revisions'), icon: <AlertCircle size={18} /> },
        { id: 'maintenances', label: t('modals.tabs.maintenances'), icon: <Tool size={18} /> }
    ];

    return (
        <Modal title={t('modals.mold_details')} onClose={onClose}>
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'info' && (
                <div className="space-y-4">
                    <InfoRow label={t('modals.form.code')} value={kalip.kod} />
                    <InfoRow label={t('modals.form.name')} value={kalip.ad} />
                    <InfoRow label={t('modals.form.project')} value={kalip.proje} />
                    <InfoRow label={t('modals.form.supplier')} value={kalip.tedarikci} />
                    <InfoRow label={t('modals.form.deadline')} value={new Date(kalip.termin).toLocaleDateString()} />
                    <InfoRow label={t('modals.form.cost')} value={`₺${kalip.maliyet}`} />
                    <InfoRow label={t('modals.form.notes')} value={kalip.notlar} />
                </div>
            )}

            {activeTab === 'trials' && (
                <div className="space-y-4">
                    <Button size="sm" onClick={() => onAddDeneme(kalip)} icon={<Plus size={16} />}>
                        {t('buttons.add_trial')}
                    </Button>
                    <div className="space-y-2">
                        {kalip.denemeler?.map((deneme, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center group hover:bg-gray-100 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-sm">{deneme.sonuc}</p>
                                        <span className={`w-2 h-2 rounded-full ${deneme.sonuc.toLowerCase().includes('onay') ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    </div>
                                    <p className="text-xs text-gray-500">{new Date(deneme.tarih).toLocaleDateString()} - {deneme.operator}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-medium block">{deneme.adet} Adet</span>
                                    <span className="text-xs text-gray-400">{deneme.hammadde}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'revisions' && (
                <div className="space-y-4">
                    <Button size="sm" onClick={() => onAddRevizyon(kalip)} icon={<Plus size={16} />}>
                        {t('buttons.add_revision')}
                    </Button>
                    <div className="space-y-2">
                        {kalip.revizyonlar?.map((rev, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-sm">{rev.islem}</p>
                                    <p className="text-xs text-gray-500">{new Date(rev.tarih).toLocaleDateString()} - {rev.firma}</p>
                                </div>
                                <span className="text-sm font-medium text-red-600">₺{rev.fiyat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'maintenances' && (
                <div className="space-y-4">
                    <Button size="sm" onClick={() => onAddBakim(kalip)} icon={<Plus size={16} />}>
                        {t('buttons.add_maintenance')}
                    </Button>
                    <div className="space-y-2">
                        {kalip.bakimlar?.map((bakim, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-sm">{bakim.islem}</p>
                                    <p className="text-xs text-gray-500">{new Date(bakim.tarih).toLocaleDateString()} - {bakim.sorumlu}</p>
                                </div>
                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">{bakim.durum}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Modal>
    );
};


export default Modal;
