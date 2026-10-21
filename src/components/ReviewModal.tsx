import React, { useState } from 'react';
import { Job } from '../types';
import { Star, X, CheckCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';

interface ReviewModalProps {
  job: Job;
  onClose: () => void;
}

export function ReviewModal({ job, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (job.id) {
      try {
        await updateDoc(doc(db, 'jobs', job.id), {
          rating,
          reviewComment: comment
        });
      } catch (err) {
        handleFirestoreError(err, 'حفظ تقييم العميل');
      }
    }
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900">تقييم جودة الخدمة</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">شكراً لتقييمك!</h4>
            <p className="text-xs text-slate-500">تم حفظ تقييمك بنجاح للمساهمة في تحسين جودة الخدمات بمدينة الجلفة.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-500">كيف كانت تجربتك مع طلب صيانة ({job.title})؟</p>
            
            {/* Star Rating */}
            <div className="flex justify-center gap-2 py-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    className={`w-8 h-8 ${
                      (hoverRating || rating) >= star 
                        ? 'fill-amber-400 text-amber-400' 
                        : 'text-slate-300'
                    }`} 
                  />
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تعليق أو ملاحظات (اختياري)</label>
              <textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="اكتب ملاحظاتك حول التزام الفني وجودة العمل..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-blue-700 transition-colors"
            >
              إرسال التقييم
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
