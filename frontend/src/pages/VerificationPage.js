import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ContactVerificationSection from '../components/ContactVerificationSection';
import { HeartIcon } from '@heroicons/react/24/outline';

const VerificationPage = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If already verified, route straight to dashboard
  if (user && user.emailVerified === true) {
    const targetDashboard = user.role === 'admin' ? '/admin' : `/dashboard/${user.role}`;
    return <Navigate to={targetDashboard} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-teal-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full space-y-6"
      >
        <ContactVerificationSection
          initialEmail={user?.email || ''}
          initialPhone={user?.phone || ''}
          userRole={user?.role || 'recipient'}
        />

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors group"
          >
            <HeartIcon className="h-4 w-4 mr-1 text-gray-400 group-hover:text-red-500 transition-colors" />
            Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default VerificationPage;
