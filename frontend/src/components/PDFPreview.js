import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';

const PDFPreview = ({ file, className = '' }) => {
  const fileUrl = useMemo(() => {
    if (!file) return null;
    return typeof file === 'string' ? file : URL.createObjectURL(file);
  }, [file]);

  if (!fileUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-500">ファイルなし</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-white ${className}`}>
      <embed
        src={fileUrl}
        type="application/pdf"
        className="w-full h-full"
        style={{ minHeight: '200px' }}
      />
    </div>
  );
};

export default PDFPreview;
