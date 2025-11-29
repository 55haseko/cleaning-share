import { ArrowUp, ArrowDown } from 'lucide-react';

const ScrollButtons = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
      {/* トップへボタン */}
      <button
        onClick={scrollToTop}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
        title="一番上に行く"
        aria-label="一番上に行く"
      >
        <ArrowUp size={20} />
      </button>

      {/* ボトムへボタン */}
      <button
        onClick={scrollToBottom}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
        title="一番下に行く"
        aria-label="一番下に行く"
      >
        <ArrowDown size={20} />
      </button>
    </div>
  );
};

export default ScrollButtons;
