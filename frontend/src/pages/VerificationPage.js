import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ContactVerificationSection from '../components/ContactVerificationSection';
import { HeartIcon } from '@heroicons/react/24/outline';

const VerificationPage = () => {
  const { user } = useAuth();

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
