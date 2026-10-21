import React, { useState, useEffect } from 'react';
import { collection, addDoc, setDoc, onSnapshot, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Service, Job, Technician } from '../types';
import { 
  Wrench, Thermometer, Wind, AlertCircle, Calendar, 
  MapPin, Camera, Star, ChevronRight, FileText, 
  Clock, Navigation, Shield, CheckCircle, Home, FileClock, Box, User, Maximize2, Smartphone, Search, Crosshair, Loader2, Phone, LogOut
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { ReviewModal } from '../components/ReviewModal';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const techIcon = new L.Icon({
  iconUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tech',
  iconSize: [32, 32],
  className: 'bg-white rounded-full border-2 border-blue-500',
});

const myLocation: [number, number] = [34.6728, 3.2546];

const DEFAULT_SERVICES: Service[] = [
  {
    id: 'srv_ac_maint',
    category: 'تكييف وتبريد',
    name: 'صيانة وتنظيف مكيف سبليت',
    basePrice: 2500,
    isActive: true,
    addOns: [{ id: 'ao_1', name: 'شحن غاز الفريون R410', price: 3500 }]
  },
  {
    id: 'srv_ac_install',
    category: 'تكييف وتبريد',
    name: 'تركيب مكيف هواء جديد',
    basePrice: 6000,
    isActive: true,
    addOns: [{ id: 'ao_2', name: 'أنابيب نحاس إضافية (متر)', price: 1800 }]
  },
  {
    id: 'srv_heating_boiler',
    category: 'تدفئة مركزية',
    name: 'فحص وصيانة غلاية التدفئة (Chaudière)',
    basePrice: 3000,
    isActive: true,
    addOns: [{ id: 'ao_3', name: 'تنظيف شبكة المشعات (Radiateurs)', price: 4000 }]
  },
  {
    id: 'srv_plumbing_leak',
    category: 'ترصيص وسباكة',
    name: 'كشف وإصلاح تسربات المياه',
    basePrice: 2000,
    isActive: true,
    addOns: [{ id: 'ao_4', name: 'تغيير محبس رئيسي أصلي', price: 1500 }]
  }
];

interface CustomerSession {
  name: string;
  phone: string;
  customerId: string;
}

const CUSTOMER_STORAGE_KEY = 'fsm_customer_session';

export function CustomerAppView() {
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name && parsed?.phone) {
          const cleanPhone = String(parsed.phone).replace(/\s+/g, '');
          return {
            name: parsed.name,
            phone: cleanPhone,
            customerId: `cust_${cleanPhone}`
          };
        }
      }
    } catch {
      // ignore parse errors
    }
    return null;
  });

  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');

  const [currentScreen, setCurrentScreen] = useState<'home' | 'booking' | 'tracking' | 'invoice' | 'assets' | 'profile' | 'bookings'>('home');
  const [bookingStep, setBookingStep] = useState(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isDirectBooking, setIsDirectBooking] = useState(false);

  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [myJobs, setMyJobs] = useState<Job[]>([]);

  const customerId = customerSession?.customerId || '';

  useEffect(() => {
    const unsubServices = onSnapshot(collection(db, 'services'), async (snapshot) => {
      if (snapshot.empty) {
        setServices(DEFAULT_SERVICES);
        for (const s of DEFAULT_SERVICES) {
          if (s.id) {
            try {
              const { id, ...rest } = s;
              await setDoc(doc(db, 'services', id), rest);
            } catch {
              // ignore seed errors
            }
          }
        }
        return;
      }
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Service));
      const activeServices = data.filter(s => s.isActive);
      setServices(activeServices.length > 0 ? activeServices : DEFAULT_SERVICES);
    }, (err) => handleFirestoreError(err, 'تحميل قائمة الخدمات'));

    return () => { unsubServices(); };
  }, []);

  useEffect(() => {
    if (!customerId) {
      setMyJobs([]);
      return;
    }

    const q = query(
      collection(db, 'jobs'),
      where('customerId', '==', customerId),
      limit(50)
    );
    const unsubJobs = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
      setMyJobs(data.sort((a, b) => b.createdAt - a.createdAt));
    }, (err) => handleFirestoreError(err, 'تحميل طلبات العميل'));

    return () => { unsubJobs(); };
  }, [customerId]);

  const handleCustomerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = loginName.trim();
    const cleanPhone = loginPhone.replace(/\s+/g, '').trim();
    if (!cleanName || !cleanPhone) return;

    const session: CustomerSession = {
      name: cleanName,
      phone: cleanPhone,
      customerId: `cust_${cleanPhone}`
    };
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));
    setCustomerSession(session);
    setCurrentScreen('home');
  };

  const handleCustomerLogout = () => {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    setCustomerSession(null);
    setLoginName('');
    setLoginPhone('');
    setCurrentScreen('home');
  };

  const handleUpdateCustomerSession = (newName: string, newPhone: string) => {
    const cleanName = newName.trim();
    const cleanPhone = newPhone.replace(/\s+/g, '').trim();
    if (!cleanName || !cleanPhone) return;
    const updated: CustomerSession = {
      name: cleanName,
      phone: cleanPhone,
      customerId: `cust_${cleanPhone}`
    };
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updated));
    setCustomerSession(updated);
  };

  const activeJob = myJobs.find(j => ['pending', 'assigned', 'in_route', 'in_progress'].includes(j.status));

  const startBooking = (serviceId: string | null, isDirect: boolean) => {
    setSelectedServiceId(serviceId);
    setIsDirectBooking(isDirect);
    setBookingStep(1);
    setCurrentScreen('booking');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden relative" dir="rtl">
      {/* Customer Initial Login Screen */}
      {!customerSession ? (
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-md border border-slate-200/80 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/20 mb-3">
                <User className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">مرحباً بك في خدمات الصيانة</h1>
              <p className="text-xs text-slate-500 leading-relaxed">
                يرجى إدخال الاسم الكامل ورقم الهاتف للدخول وطلب خدمات الصيانة الميدانية ومتابعة حجوزاتك.
              </p>
            </div>

            <form onSubmit={handleCustomerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الاسم الكامل للزبون
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="مثال: محمد بن عبد الله"
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف (معرف الحساب)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    placeholder="0550123456"
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-right font-mono focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                دخول ومتابعة للخدمات
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
                {currentScreen === 'home' && (
                  <CustomerHome 
                    customer={customerSession}
                    services={services}
                    activeJob={activeJob}
                    onBook={startBooking} 
                    onTrack={() => setCurrentScreen('tracking')}
                    onInvoice={() => setCurrentScreen('invoice')}
                    onLogout={handleCustomerLogout}
                  />
                )}
                {currentScreen === 'booking' && (
                  <BookingFlow 
                    step={bookingStep} 
                    setStep={setBookingStep}
                    serviceId={selectedServiceId}
                    isDirect={isDirectBooking}
                    services={services}
                    customerId={customerSession.customerId}
                    customerName={customerSession.name}
                    customerPhone={customerSession.phone}
                    onFinish={() => setCurrentScreen('home')}
                    onCancel={() => setCurrentScreen('home')}
                  />
                )}
                {currentScreen === 'tracking' && activeJob && (
                  <TrackingScreen job={activeJob} onBack={() => setCurrentScreen('home')} />
                )}
                {currentScreen === 'invoice' && (
                  <InvoiceScreen job={myJobs.find(j => j.status === 'completed')} onBack={() => setCurrentScreen('home')} />
                )}
                {currentScreen === 'assets' && (
                  <AssetsScreen onBack={() => setCurrentScreen('home')} />
                )}
                {currentScreen === 'profile' && (
                  <CustomerProfileScreen
                    customer={customerSession}
                    onSave={handleUpdateCustomerSession}
                    onLogout={handleCustomerLogout}
                    onBack={() => setCurrentScreen('home')}
                  />
                )}
                {currentScreen === 'bookings' && (
                  <CustomerBookingsScreen jobs={myJobs} onBack={() => setCurrentScreen('home')} />
                )}
              </div>

              {/* Bottom Navigation */}
              {['home', 'assets', 'profile', 'bookings'].includes(currentScreen) && (
                <div className="bg-white border-t border-slate-200 flex items-center justify-around p-3 pb-6 shrink-0 z-40">
                  <button onClick={() => setCurrentScreen('home')} className={`flex flex-col items-center transition-colors ${currentScreen === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                     <Home className="w-6 h-6" />
                     <span className="text-[10px] mt-1 font-bold">الرئيسية</span>
                  </button>
                  <button onClick={() => setCurrentScreen('bookings')} className={`flex flex-col items-center transition-colors ${currentScreen === 'bookings' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                     <FileClock className="w-6 h-6" />
                     <span className="text-[10px] mt-1 font-bold">حجوزاتي</span>
                  </button>
                  <button onClick={() => setCurrentScreen('assets')} className={`flex flex-col items-center transition-colors ${currentScreen === 'assets' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                     <Box className="w-6 h-6" />
                     <span className="text-[10px] mt-1 font-bold">أجهزتي</span>
                  </button>
                  <button onClick={() => setCurrentScreen('profile')} className={`flex flex-col items-center transition-colors ${currentScreen === 'profile' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                     <User className="w-6 h-6" />
                     <span className="text-[10px] mt-1 font-bold">حسابي</span>
                  </button>
                </div>
              )}
            </>
          )}
    </div>
  );
}

function CustomerHome({ customer, services, activeJob, onBook, onTrack, onLogout }: any) {
  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="bg-blue-600 px-6 pt-6 pb-12 rounded-b-3xl shadow-sm text-white shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold mb-1">مرحباً، {customer?.name}</h1>
          <p className="text-blue-100 text-xs font-mono" dir="ltr">{customer?.phone}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="تسجيل الخروج / تغيير الحساب"
          className="bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>خروج</span>
        </button>
      </div>

      <div className="px-6 -mt-8 relative z-10 space-y-6">
        {/* Active Job Tracker */}
        {activeJob && (
          <div onClick={onTrack} className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {activeJob.status === 'pending' ? 'جاري البحث عن فني...' : 
                   activeJob.status === 'assigned' ? 'تم تعيين فني لطلبك' :
                   activeJob.status === 'in_route' ? 'الفني في الطريق إليك' : 'الفني يعمل الآن'}
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1">اضغط للتتبع المباشر</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </div>
        )}

        {/* Book Services Catalog */}
        <div>
          <h2 className="font-bold text-slate-800 text-sm mb-3">دليل الخدمات (حجز مباشر)</h2>
          <div className="grid grid-cols-2 gap-3">
            {services.map((s: Service) => (
              <div 
                key={s.id} 
                onClick={() => onBook(s.id, true)} 
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform text-center aspect-square hover:border-blue-300"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                  <Wrench className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-700 leading-tight">{s.name}</span>
                <span className="text-[10px] font-bold text-blue-600">{s.basePrice} دج</span>
              </div>
            ))}
          </div>
        </div>

        {/* Full 5-Step Flow Trigger Button */}
        <button 
          onClick={() => onBook(null, false)} 
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
          <Wrench className="w-5 h-5" />
          طلب خدمة
        </button>
      </div>
    </div>
  );
}

function MapViewUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 15), { animate: true, duration: 0.7 });
  }, [center[0], center[1], map]);
  return null;
}

function BookingFlow({ step, setStep, serviceId, isDirect, services, customerId, customerName, customerPhone, onFinish, onCancel }: any) {
  const selectedService = services.find((s: Service) => s.id === serviceId);
  
  const [desc, setDesc] = useState('');
  const [categoryId, setCategoryId] = useState(selectedService?.category || 'تكييف وتبريد');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState<[number, number]>(myLocation);
  const [address, setAddress] = useState('الجلفة، حي البساتين');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsFeedback, setGpsFeedback] = useState<string | null>(null);
  const isUserTypingRef = React.useRef(false);

  const categories = ['ترصيص وسباكة', 'تكييف وتبريد', 'تدفئة مركزية'];

  // 1) Map -> Text Input: Reverse Geocoding via Nominatim
  const reverseGeocode = async (lat: number, lng: number) => {
    isUserTypingRef.current = false;
    setLocation([lat, lng]);
    setAddress('جاري جلب العنوان...');
    setGpsFeedback(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
      );
      if (!res.ok) throw new Error('Reverse geocode error');
      const data = await res.json();
      const addr = data?.address;
      if (addr) {
        const parts = [
          addr.city || addr.town || addr.village || addr.municipality || addr.state,
          addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.city_district,
          addr.road || addr.pedestrian || addr.amenity || addr.building
        ].filter(Boolean);
        const uniqueParts = Array.from(new Set(parts));
        if (uniqueParts.length > 0) {
          setAddress(uniqueParts.join('، '));
          return;
        }
      }
      if (data?.display_name) {
        const shortName = data.display_name
          .split(',')
          .slice(0, 3)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .join('، ');
        setAddress(shortName || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (err) {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  // 2) Text Input -> Map: Forward Search via Nominatim
  const forwardGeocode = async (queryText?: string) => {
    const q = (queryText ?? address).trim();
    if (!q || q === 'جاري جلب العنوان...' || q.length < 2) return;
    setIsSearchingMap(true);
    setGpsFeedback(null);
    try {
      let res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&accept-language=ar`
      );
      let data = await res.json();
      if ((!data || data.length === 0) && !q.includes('الجزائر')) {
        res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ' الجزائر')}&accept-language=ar`
        );
        data = await res.json();
      }
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          isUserTypingRef.current = false;
          setLocation([lat, lon]);
        }
      }
    } catch (err) {
      console.error('Error searching location:', err);
    } finally {
      setIsSearchingMap(false);
    }
  };

  // Automatic 1-second debounce when user stops typing in the address field
  useEffect(() => {
    if (!isUserTypingRef.current) return;
    const trimmed = address.trim();
    if (!trimmed || trimmed === 'جاري جلب العنوان...' || trimmed.length < 3) return;
    const timer = setTimeout(() => {
      if (isUserTypingRef.current) {
        forwardGeocode(trimmed);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [address]);

  // 3) Current GPS Location button
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsFeedback('المتصفح لا يدعم تحديد الموقع (GPS)');
      return;
    }
    setIsLocatingGps(true);
    setGpsFeedback(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setIsLocatingGps(false);
        setGpsFeedback('تعذر جلب موقع GPS تلقائياً (تأكد من صلاحية الموقع أو حدد النقطة من الخريطة)');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  
  const submitBooking = async () => {
    try {
      const cleanAddr = address.trim();
      const finalAddress = (cleanAddr && cleanAddr !== 'جاري جلب العنوان...') ? cleanAddr : `${location[0].toFixed(5)}, ${location[1].toFixed(5)}`;
      const orderDesc = desc 
        ? `${desc} | العنوان: ${finalAddress}` 
        : (selectedService?.name ? `${selectedService.name} - ${finalAddress}` : `طلب صيانة - ${finalAddress}`);

      await addDoc(collection(db, 'jobs'), {
        customerId,
        customerName: customerName || '',
        customerPhone: customerPhone || '',
        technicianId: null,
        status: 'pending',
        type: categoryId,
        title: selectedService?.name || 'طلب صيانة جديد',
        description: orderDesc,
        location: { latitude: location[0], longitude: location[1] },
        address: finalAddress,
        customerLocation: {
          latitude: location[0],
          longitude: location[1],
          address: finalAddress
        },
        serviceId: serviceId || 'custom',
        pricing: { basePrice: selectedService?.basePrice || 50, addOnTotal: 0, finalTotal: selectedService?.basePrice || 50 },
        addons: [],
        createdAt: Date.now()
      });
      // Move to success step
      setStep(isDirect ? 4 : 6);
    } catch(e) { 
      handleFirestoreError(e, 'إنشاء وحفظ الطلب'); 
    }
  };

  const LocationMarker = () => {
    useMapEvents({
      click(e: any) {
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      },
    });
    return location ? (
      <Marker 
        position={location} 
        draggable={true}
        eventHandlers={{
          dragend(e: any) {
            const marker = e.target;
            const pos = marker.getLatLng();
            reverseGeocode(pos.lat, pos.lng);
          }
        }}
      >
        <Popup>
          <div className="text-right text-xs font-bold" dir="rtl">
            📍 موقع الخدمة: {address}
          </div>
        </Popup>
      </Marker>
    ) : null;
  };

  const renderLocationPickerStep = (nextStep: number, nextButtonLabel: string) => (
    <div className="flex-1 flex flex-col space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>العنوان التفصيلي / اسم الحي والشارع</span>
          </label>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingGps}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLocatingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Crosshair className="w-3.5 h-3.5" />
            )}
            <span>تحديد موقعي الحالي (GPS)</span>
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={address} 
              onChange={e => {
                isUserTypingRef.current = true;
                setAddress(e.target.value);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  forwardGeocode(address);
                }
              }}
              placeholder="مثال: الجلفة، حي البساتين، شارع أول نوفمبر"
              className="w-full bg-white border-2 border-slate-200 focus:border-blue-600 rounded-xl p-3 text-sm focus:outline-none font-bold text-slate-800 shadow-xs" 
              required
            />
          </div>
          <button
            type="button"
            onClick={() => forwardGeocode(address)}
            disabled={isSearchingMap || !address.trim() || address === 'جاري جلب العنوان...'}
            title="تحديد على الخريطة"
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSearchingMap ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">تحديد على الخريطة</span>
          </button>
        </div>

        {gpsFeedback && (
          <p className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
            ⚠️ {gpsFeedback}
          </p>
        )}

        <p className="text-[11px] text-slate-500 flex items-center justify-between">
          <span>📍 انقر على الخريطة أو اسحب الدبوس لجلب اسم الحي تلقائياً</span>
          <span className="font-mono text-[10px] text-slate-400" dir="ltr">
            {location[0].toFixed(4)}, {location[1].toFixed(4)}
          </span>
        </p>
      </div>

      <div className="flex-1 min-h-[210px] rounded-xl overflow-hidden border-2 border-slate-200 relative">
        <MapContainer center={location} zoom={14} className="w-full h-full" zoomControl={false}>
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapViewUpdater center={location} />
          <LocationMarker />
        </MapContainer>
      </div>

      <button 
        disabled={!address.trim() || address === 'جاري جلب العنوان...'} 
        onClick={() => setStep(nextStep)} 
        className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-md shrink-0 disabled:opacity-50 cursor-pointer"
      >
        {nextButtonLabel}
      </button>
    </div>
  );

  // Header Title Logic
  const getHeaderTitle = () => {
    if (isDirect) {
      if (step === 1) return 'اختر الموعد (حجز مباشر)';
      if (step === 2) return 'موقع الخدمة';
      if (step === 3) return 'الكشف التقديري';
      return 'تم الحجز';
    } else {
      if (step === 1) return 'اختيار الفئة';
      if (step === 2) return 'تفاصيل المشكلة';
      if (step === 3) return 'الموعد المناسب';
      if (step === 4) return 'موقع الخدمة';
      if (step === 5) return 'الكشف التقديري';
      return 'تم الحجز';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden" dir="rtl">
      <div className="bg-white px-4 py-4 border-b border-slate-200 flex items-center shrink-0">
        <button onClick={() => {
          if (step > 1) setStep(step - 1);
          else onCancel();
        }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="flex-1 text-center font-bold text-slate-800 text-base ml-10">
          {getHeaderTitle()}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        {/* DIRECT ROUTE */}
        {isDirect ? (
          <>
            {/* Step 1: Calendar & Time Picker */}
            {step === 1 && (
              <div className="space-y-6 flex-1">
                {selectedService && (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-bold uppercase">{selectedService.category}</p>
                      <h3 className="font-bold text-slate-900 text-base">{selectedService.name}</h3>
                    </div>
                    <span className="font-bold text-blue-700 text-lg">{selectedService.basePrice} دج</span>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">التاريخ</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">الوقت المناسب</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['08:00 ص', '10:00 ص', '02:00 م', '04:00 م'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setTime(t)}
                        className={`p-3 rounded-xl border-2 text-sm font-bold ${time === t ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button disabled={!date || !time} onClick={() => setStep(2)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-auto disabled:opacity-50">التالي: تحديد الموقع</button>
              </div>
            )}

            {/* Step 2: Location Map */}
            {step === 2 && renderLocationPickerStep(3, 'التالي: الكشف التقديري')}

            {/* Step 3: Estimated Bill */}
            {step === 3 && (
              <div className="flex-1 flex flex-col">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{selectedService?.name || 'خدمة صيانة'}</h3>
                    <p className="text-sm text-slate-500">{selectedService?.category || categoryId}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">الموعد المحدد</span>
                      <span className="font-bold">{date} - {time}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">عنوان الموقع</span>
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">{address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">الوقت المتوقع للوصول (ETA)</span>
                      <span className="font-bold text-amber-600">خلال 30 دقيقة</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-4">
                    <span className="font-bold text-slate-700">التكلفة الأساسية للخدمة</span>
                    <span className="font-bold text-blue-600 text-xl">{selectedService?.basePrice || 50} دج</span>
                  </div>
                </div>
                <button onClick={submitBooking} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-auto cursor-pointer">تأكيد وإرسال الطلب</button>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">تم حجز الخدمة بنجاح!</h2>
                <p className="text-sm text-slate-500">تم تسجيل طلبك وجاري تعيين أقرب فني متخصص.</p>
                <button onClick={onFinish} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-8">العودة للرئيسية</button>
              </div>
            )}
          </>
        ) : (
          /* FULL 5-STEP ROUTE */
          <>
            {/* Step 1: Category Selection */}
            {step === 1 && (
              <div className="space-y-4 flex-1">
                <h3 className="font-bold text-lg mb-4 text-slate-800">1. اختر فئة الخدمة</h3>
                {categories.map(cat => (
                  <div 
                    key={cat}
                    onClick={() => { setCategoryId(cat); setStep(2); }} 
                    className="bg-white p-5 rounded-2xl border-2 border-slate-200 cursor-pointer active:scale-95 transition-transform flex items-center gap-4 hover:border-blue-300"
                  >
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{cat}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">طلب خدمة شامل مع الكشف</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step 2: Problem Details */}
            {step === 2 && (
              <div className="space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">2. وصف المشكلة</label>
                  <textarea 
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none"
                    placeholder="يرجى كتابة وصف مختصر للمشكلة الميدانية..."
                  />
                </div>
                <button disabled={!desc} onClick={() => setStep(3)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-auto disabled:opacity-50">متابعة إلى الموعد</button>
              </div>
            )}

            {/* Step 3: Calendar & Time */}
            {step === 3 && (
              <div className="space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">3. الموعد المناسب</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">الوقت المتاح</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['08:00 ص', '10:00 ص', '02:00 م', '04:00 م'].map(t => (
                      <button 
                        key={t}
                        onClick={() => setTime(t)}
                        className={`p-3 rounded-xl border-2 text-sm font-bold ${time === t ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-600'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <button disabled={!date || !time} onClick={() => setStep(4)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-auto disabled:opacity-50">متابعة إلى موقع الخدمة</button>
              </div>
            )}

            {/* Step 4: Location Map */}
            {step === 4 && renderLocationPickerStep(5, 'تأكيد الموقع والذهاب للكشف')}

            {/* Step 5: Estimated Bill */}
            {step === 5 && (
              <div className="flex-1 flex flex-col">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">5. الكشف التقديري</h3>
                    <p className="text-sm text-slate-500">{categoryId}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-600">الموعد</span>
                      <span className="font-bold">{date} - {time}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">عنوان الموقع</span>
                      <span className="font-bold text-slate-900 truncate max-w-[200px]">{address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">الوقت المتوقع للوصول (ETA)</span>
                      <span className="font-bold text-amber-600">خلال 30 دقيقة</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-4">
                    <span className="font-bold text-slate-700">رسوم الكشف والزيارة المبدئية</span>
                    <span className="font-bold text-blue-600 text-xl">50.00 دج</span>
                  </div>
                </div>
                <button onClick={submitBooking} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-auto cursor-pointer">تأكيد وإرسال الطلب النهائي</button>
              </div>
            )}

            {/* Step 6: Confirmation */}
            {step === 6 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">تم إرسال طلبك بنجاح!</h2>
                <p className="text-sm text-slate-500">جاري تعيين الفني المناسب وتجهيز العتاد المطلوب.</p>
                <button onClick={onFinish} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm shadow-md mt-8">العودة للرئيسية</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TrackingScreen({ job, onBack }: any) {
  const [tech, setTech] = useState<Technician | null>(null);

  useEffect(() => {
    if (job?.technicianId) {
      const unsub = onSnapshot(doc(db, 'technicians', job.technicianId), (doc) => {
        setTech(doc.data() as Technician);
      });
      return () => unsub();
    }
  }, [job]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative">
      <div className="absolute top-4 right-4 z-[1000]">
        <button onClick={onBack} className="w-10 h-10 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-md">
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden bg-slate-200">
        <MapContainer 
          center={job?.location ? [job.location.latitude, job.location.longitude] : myLocation} 
          zoom={14} 
          className="w-full h-full" 
          zoomControl={false}
        >
          <TileLayer 
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker position={job?.location ? [job.location.latitude, job.location.longitude] : myLocation}>
            <Popup>{job?.address || 'موقعك'}</Popup>
          </Marker>
          {tech?.location && (
            <Marker position={[tech.location.latitude, tech.location.longitude]} icon={techIcon}>
              <Popup>الفني ({tech.name})</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6 relative z-20">
        {tech ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">{tech.name}</h3>
                <p className="text-xs text-slate-500">متخصص {tech.expertise.join(' و ')}</p>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-400">حالة الطلب</p>
                <p className="font-bold text-blue-600 text-sm mt-1">
                  {job.status === 'in_route' ? 'في الطريق' : 'جاري العمل'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">اتصال بالفني</button>
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            <h3 className="font-bold text-slate-900 mb-2">جاري البحث عن فني...</h3>
            <p className="text-sm text-slate-500">نحن نبحث عن أقرب فني متاح لخدمتك.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InvoiceScreen({ job, onBack }: any) {
  if (!job) return <div className="p-6 text-center text-slate-500 font-bold" onClick={onBack}>لا توجد فواتير سابقة</div>;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden" dir="rtl">
      <div className="bg-white px-4 py-4 border-b border-slate-200 flex items-center shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="flex-1 text-center font-bold text-slate-800 text-base ml-10">الفاتورة والضمان</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">رقم الفاتورة</p>
              <p className="font-bold text-slate-900 mt-1">#{job.id?.slice(-6)}</p>
            </div>
            <div className="text-left">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
                {job.paymentMethod === 'onsite' ? 'تم الدفع نقداً بالموقع' : 'دفع معتمد للمقر'}
              </span>
            </div>
          </div>
          <div className="mb-4 text-xs space-y-1.5 pb-4 border-b border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-500">الخدمة:</span>
              <span className="font-bold text-slate-800">{job.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">العنوان:</span>
              <span className="font-bold text-slate-800">{job.address}</span>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">زيارة كشف وتشخيص</span>
              <span className="font-bold text-slate-900">{(job.pricing?.basePrice || 0).toFixed(2)} دج</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">قطع غيار وإضافات منجزة</span>
              <span className="font-bold text-slate-900">{(job.pricing?.addOnTotal || 0).toFixed(2)} دج</span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
            <span className="font-bold text-slate-800">الإجمالي النهائي</span>
            <span className="font-bold text-blue-600 text-xl">{(job.pricing?.finalTotal || 0).toFixed(2)} دج</span>
          </div>
        </div>

        {/* Proof of Work and Guarantee Section */}
        {job.proofOfWork && (job.proofOfWork.beforePhoto || job.proofOfWork.afterPhoto || job.proofOfWork.customerSignature) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-600" />
              <span>إثبات العمل الميداني الموثق</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {job.proofOfWork.beforePhoto && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <img src={job.proofOfWork.beforePhoto} alt="قبل العمل" className="w-full h-28 object-cover" />
                  <p className="text-[10px] text-center font-bold text-slate-600 py-1 bg-slate-50">قبل العمل</p>
                </div>
              )}
              {job.proofOfWork.afterPhoto && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <img src={job.proofOfWork.afterPhoto} alt="بعد العمل" className="w-full h-28 object-cover" />
                  <p className="text-[10px] text-center font-bold text-slate-600 py-1 bg-slate-50">بعد العمل</p>
                </div>
              )}
            </div>
            {job.proofOfWork.customerSignature && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-center">
                <p className="text-[10px] font-bold text-slate-500 mb-2">توقيع استلام وإقرار العميل</p>
                <img src={job.proofOfWork.customerSignature} alt="توقيع العميل" className="h-16 mx-auto object-contain bg-white rounded-lg p-1 border border-slate-200" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetsScreen({ onBack }: any) {
  const assets = [
    {
      id: 'ast_1',
      name: 'مكيف هواء سبليت 18000 وحدة',
      category: 'تكييف وتبريد',
      installDate: '2026-03-01',
      warrantyExpiry: '2026-09-01',
      status: 'ساري',
      certificateNo: 'WAR-2026-8841'
    },
    {
      id: 'ast_2',
      name: 'سخان المياه المركزي (غلاية)',
      category: 'تدفئة مركزية',
      installDate: '2026-01-15',
      warrantyExpiry: '2026-07-15',
      status: 'ساري',
      certificateNo: 'WAR-2026-3392'
    },
    {
      id: 'ast_3',
      name: 'محبس رئيسي ونظام تصريف سباكة',
      category: 'ترصيص وسباكة',
      installDate: '2025-11-10',
      warrantyExpiry: '2026-05-10',
      status: 'منتهي',
      certificateNo: 'WAR-2025-1102'
    }
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full overflow-hidden">
      <div className="bg-white px-4 py-4 border-b border-slate-200 flex items-center shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="flex-1 text-center font-bold text-slate-800 text-base ml-10">أجهزتي وضماناتي الرقمية</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-sm mb-2">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-200" />
            <div>
              <h3 className="font-bold text-sm">شهادات الضمان الرقمي المعتمدة</h3>
              <p className="text-xs text-blue-100 mt-0.5">جميع قطع الغيار والتركيبات مغطاة بضمان رسمي لمدة 6 أشهر.</p>
            </div>
          </div>
        </div>

        {assets.map((asset) => (
          <div key={asset.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex justify-between items-start">
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                asset.status === 'ساري' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {asset.status === 'ساري' ? '✓ ضمان ساري' : 'منتهي الصلاحية'}
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">{asset.certificateNo}</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">{asset.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{asset.category}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block">تاريخ التركيب:</span>
                <span className="font-bold text-slate-700">{asset.installDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">نهاية الضمان:</span>
                <span className="font-bold text-slate-700">{asset.warrantyExpiry}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomerProfileScreen({ customer, onSave, onLogout, onBack }: { customer: CustomerSession; onSave: (name: string, phone: string) => void; onLogout: () => void; onBack: () => void }) {
  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState('الجلفة، حي البساتين');

  const handleSave = () => {
    onSave(name, phone);
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full">
      <div className="bg-white px-4 py-4 border-b border-slate-200 flex items-center shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="flex-1 text-center font-bold text-slate-800 text-base ml-10">حسابي الشخصي</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-xs text-blue-900 flex items-center justify-between">
          <span>معرف العميل المسجل:</span>
          <span className="font-mono font-bold" dir="ltr">{customer?.customerId}</span>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">الاسم الكامل</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">رقم الهاتف</label>
          <input dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-right font-mono" />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">العنوان الافتراضي</label>
          <input value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors mt-2 cursor-pointer">
          حفظ التغييرات
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج من الحساب</span>
        </button>
      </div>
    </div>
  );
}

function CustomerBookingsScreen({ jobs, onBack }: { jobs: Job[], onBack: () => void }) {
  const [selectedJobForReview, setSelectedJobForReview] = useState<Job | null>(null);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full">
      <div className="bg-white px-4 py-4 border-b border-slate-200 flex items-center shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronRight className="w-6 h-6 text-slate-700" />
        </button>
        <h2 className="flex-1 text-center font-bold text-slate-800 text-base ml-10">حجوزاتي وتقييم الخدمات</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {jobs.length === 0 && <p className="text-center text-slate-500 text-sm mt-4">لا توجد طلبات</p>}
        {jobs.map(job => (
          <div key={job.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-2">
            <div className="flex justify-between items-start">
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${
                job.status === 'pending' ? 'bg-slate-100 text-slate-600' :
                job.status === 'assigned' ? 'bg-indigo-50 text-indigo-600' :
                job.status === 'in_route' ? 'bg-amber-50 text-amber-600' :
                job.status === 'in_progress' ? 'bg-purple-50 text-purple-600' :
                job.status === 'completed' ? 'bg-green-50 text-green-600' :
                'bg-slate-50 text-slate-600'
              }`}>
                {job.status === 'pending' ? 'قيد الانتظار' :
                 job.status === 'assigned' ? 'تم التعيين' :
                 job.status === 'in_route' ? 'الفني في الطريق' :
                 job.status === 'in_progress' ? 'قيد العمل' : 'مكتملة'}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {new Date(job.createdAt).toLocaleDateString('ar-DZ-u-nu-latn')}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 text-sm">{job.title}</h3>
            <p className="text-xs text-slate-500 line-clamp-1">{job.description}</p>
            
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="font-bold text-blue-600 text-sm">{(job.pricing?.finalTotal || job.pricing?.basePrice || 0).toFixed(2)} دج</span>
              
              {job.status === 'completed' && (
                <button
                  onClick={() => setSelectedJobForReview(job)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    job.rating ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${job.rating ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{job.rating ? `تقييمك: ${job.rating}/5 ★` : 'قيم الخدمة'}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedJobForReview && (
        <ReviewModal job={selectedJobForReview} onClose={() => setSelectedJobForReview(null)} />
      )}
    </div>
  )
}
