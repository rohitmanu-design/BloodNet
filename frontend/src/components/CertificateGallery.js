import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DocumentTextIcon,
  TrophyIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  XMarkIcon,
  CheckCircleIcon,
  SparklesIcon,
  HeartIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { certificateAPI } from '../services/api';

const CertificateGallery = ({ userId }) => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [showFullCertificate, setShowFullCertificate] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchCertificates();
  }, [userId]);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await certificateAPI.getMyCertificates();
      setCertificates(response.data || []);
    } catch (err) {
      console.error('Error fetching certificates:', err);
      setError(err.response?.data?.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCertificate = (cert) => {
    setSelectedCertificate(cert);
    setShowFullCertificate(true);
  };

  const handleShareCertificate = async (certificateId) => {
    try {
      const res = await certificateAPI.shareCertificate(certificateId);
      setCertificates(prev => prev.map(cert => 
        cert._id === certificateId 
          ? { ...cert, isPublic: res.data?.isPublic ?? true, sharedOn: new Date() }
          : cert
      ));
      if (selectedCertificate && selectedCertificate._id === certificateId) {
        setSelectedCertificate(prev => ({ ...prev, isPublic: res.data?.isPublic ?? true }));
      }
      setCopiedId(certificateId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Error sharing certificate:', err);
    }
  };

  const handleDownloadCertificate = async (certificateId) => {
    try {
      const response = await certificateAPI.downloadCertificate(certificateId);
      const blob = new Blob([response.data], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const certificate = certificates.find(c => c._id === certificateId) || selectedCertificate;
      link.download = `bloodnet-certificate-${certificate?.certificateNumber || 'donor'}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setCertificates(prev => prev.map(cert => 
        cert._id === certificateId 
          ? { ...cert, downloadCount: (cert.downloadCount || 0) + 1 }
          : cert
      ));
    } catch (err) {
      console.error('Error downloading certificate:', err);
    }
  };

  const handlePrintModal = () => {
    window.print();
  };

  const totalCertificates = certificates.length;
  const totalLivesSaved = certificates.reduce((sum, c) => sum + (c.livesSaved || 3), 0);
  const totalUnits = certificates.reduce((sum, c) => sum + (c.unitsDonated || 1), 0);
  const sharedCertificates = certificates.filter(c => c.isPublic).length;

  if (loading) {
    return (
      <div className="py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-2xs">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-3"></div>
        <p className="text-sm font-semibold text-gray-700">Loading your verified certificates...</p>
        <p className="text-xs text-gray-400 mt-0.5">Verifying blockchain-secured donation records</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-2xs p-6">
        <DocumentTextIcon className="h-14 w-14 text-rose-400 mx-auto mb-3" />
        <h4 className="text-base font-bold text-gray-900 mb-1">Unable to Load Certificates</h4>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">{error}</p>
        <button
          onClick={fetchCertificates}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl shadow-2xs border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <TrophyIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{totalCertificates}</p>
            <p className="text-xs text-gray-500 font-medium">Earned Certificates</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-2xs border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <HeartIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{totalLivesSaved}</p>
            <p className="text-xs text-gray-500 font-medium">Estimated Lives Saved</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-2xs border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{totalUnits} Unit(s)</p>
            <p className="text-xs text-gray-500 font-medium">Total Blood Donated</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-2xs border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShareIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-gray-900">{sharedCertificates}</p>
            <p className="text-xs text-gray-500 font-medium">Publicly Verified</p>
          </div>
        </div>
      </div>

      {/* Certificates Gallery List */}
      {certificates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 p-8">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrophyIcon className="h-8 w-8 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Certificates Awarded Yet</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Official Certificates of Appreciation are automatically generated and awarded for every verified blood donation. Once a recipient marks your donation as fulfilled, your verified certificate will appear here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {certificates.map((cert, index) => {
              const donationDate = cert.donationDate
                ? new Date(cert.donationDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Verified Donation';

              return (
                <motion.div
                  key={cert._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-2xl border border-gray-200/80 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group"
                >
                  {/* Top Certificate Ribbon Header */}
                  <div className="p-5 bg-gradient-to-br from-rose-50 via-red-50/40 to-white border-b border-rose-100/70 relative">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-200">
                        <SparklesIcon className="w-3 h-3" />
                        {cert.milestoneBadge || 'Verified Donation'}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 font-mono">
                        {cert.certificateNumber}
                      </span>
                    </div>

                    <h4 className="text-base font-extrabold text-gray-900 group-hover:text-red-700 transition-colors">
                      {cert.certificateTitle || 'Certificate of Appreciation'}
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5 font-medium">
                      Awarded to <span className="font-bold text-gray-900">{cert.donorName}</span>
                    </p>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-2.5 text-xs text-gray-600 flex-1">
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500 font-medium flex items-center gap-1">
                        <CalendarIcon className="w-3.5 h-3.5 text-gray-400" /> Date
                      </span>
                      <span className="font-bold text-gray-800">{donationDate}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500 font-medium flex items-center gap-1">
                        <HeartIcon className="w-3.5 h-3.5 text-red-500" /> Blood Group
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-extrabold text-xs">
                        {cert.bloodGroup}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500 font-medium flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3.5 h-3.5 text-gray-400" /> Hospital
                      </span>
                      <span className="font-semibold text-gray-800 truncate max-w-[170px]" title={cert.hospitalName}>
                        {cert.hospitalName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-500 font-medium">Impact</span>
                      <span className="font-bold text-emerald-700">
                        ~{cert.livesSaved || 3} Lives Impacted
                      </span>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleViewCertificate(cert)}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <span>View Certificate</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownloadCertificate(cert._id)}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-red-700 hover:bg-white hover:border-red-200 transition-colors"
                        title="Download Printable Certificate"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShareCertificate(cert._id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          copiedId === cert._id
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'border-gray-200 text-gray-600 hover:text-blue-700 hover:bg-white hover:border-blue-200'
                        }`}
                        title="Toggle Share / Copy ID"
                      >
                        {copiedId === cert._id ? <CheckCircleIcon className="w-4 h-4" /> : <ShareIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Full Certificate Modal */}
      <AnimatePresence>
        {showFullCertificate && selectedCertificate && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setShowFullCertificate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-xs border-b border-gray-200 px-6 py-3.5 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <TrophyIcon className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-gray-900 text-sm">Official Life Saver Certificate</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintModal}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Print Certificate"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Print</span>
                  </button>
                  <button
                    onClick={() => handleDownloadCertificate(selectedCertificate._id)}
                    className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => setShowFullCertificate(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Certificate Frame */}
              <div className="p-6 sm:p-10 bg-slate-50">
                <div className="bg-white rounded-lg border-[10px] border-double border-red-900 p-8 sm:p-12 relative shadow-lg overflow-hidden text-center">
                  {/* Watermark Crest */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <HeartIcon className="w-[420px] h-[420px] text-red-900" />
                  </div>

                  {/* Header Badge */}
                  <div className="mb-2">
                    <span className="px-3.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-extrabold uppercase tracking-widest">
                      BloodNet+ Life Saver Award
                    </span>
                  </div>

                  {/* Certificate Title */}
                  <h1 className="text-2xl sm:text-4xl font-black text-rose-950 uppercase tracking-widest font-serif mt-2 mb-1">
                    {selectedCertificate.certificateTitle || 'Certificate of Appreciation'}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-widest font-semibold mb-6">
                    For Noble & Voluntary Blood Donation
                  </p>

                  <p className="text-xs sm:text-sm text-gray-600 italic">This certificate is proudly awarded to</p>

                  {/* Donor Name */}
                  <div className="my-4">
                    <span className="text-2xl sm:text-4xl font-extrabold text-gray-900 border-b-2 border-amber-600 pb-2 px-6 inline-block font-serif tracking-wide">
                      {selectedCertificate.donorName}
                    </span>
                  </div>

                  {/* Appreciation Quote */}
                  <p className="text-xs sm:text-sm text-gray-600 max-w-xl mx-auto leading-relaxed my-4">
                    "{selectedCertificate.impactMessage}"
                  </p>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 max-w-2xl mx-auto text-left">
                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-rose-900 tracking-wider block">Blood Group</span>
                      <span className="text-sm font-extrabold text-rose-700">{selectedCertificate.bloodGroup}</span>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-rose-900 tracking-wider block">Donated Units</span>
                      <span className="text-sm font-extrabold text-gray-900">{selectedCertificate.unitsDonated || 1} Unit(s)</span>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-rose-900 tracking-wider block">Lives Impacted</span>
                      <span className="text-sm font-extrabold text-emerald-700">~{selectedCertificate.livesSaved || 3} Lives</span>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-rose-900 tracking-wider block">Donation Date</span>
                      <span className="text-sm font-extrabold text-gray-900">
                        {new Date(selectedCertificate.donationDate || selectedCertificate.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Facility Details */}
                  <div className="text-xs text-gray-500 mb-8 max-w-lg mx-auto">
                    <p className="truncate">
                      Facility: <span className="font-semibold text-gray-800">{selectedCertificate.hospitalName}</span>
                    </p>
                    <p className="truncate">
                      Location: <span className="font-semibold text-gray-800">{selectedCertificate.donationLocation}</span>
                    </p>
                  </div>

                  {/* Bottom Verification & Signatures */}
                  <div className="pt-6 border-t border-dashed border-gray-300 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-gray-600">
                    <div className="text-center sm:text-left">
                      <div className="w-36 border-b border-gray-800 mb-1 mx-auto sm:mx-0"></div>
                      <p className="font-bold text-gray-900 text-xs">Medical Director</p>
                      <p className="text-[10px] text-gray-500 uppercase">BloodNet+ Life Saver Foundation</p>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-700 to-rose-900 border-2 border-amber-400 shadow-md flex items-center justify-center text-white text-[9px] font-black text-center leading-tight p-1">
                        OFFICIAL<br />VERIFIED<br />SEAL
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      {selectedCertificate.qrCode && (
                        <img
                          src={selectedCertificate.qrCode}
                          alt="QR Verification"
                          className="w-14 h-14 border border-gray-200 rounded-md p-1 shadow-2xs"
                        />
                      )}
                      <div className="text-[10px] text-gray-500 text-left sm:text-right">
                        <p className="font-mono font-bold text-gray-800">No: {selectedCertificate.certificateNumber}</p>
                        <p>Verified on BloodNet+</p>
                        <p>Status: Authenticated</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CertificateGallery;
