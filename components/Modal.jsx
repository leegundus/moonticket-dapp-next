export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl relative text-white">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-white text-2xl leading-none hover:text-yellow-400"
        >
          ×
        </button>

        {title && (
          <h2 className="text-xl font-semibold mb-4 text-center text-yellow-400">
            {title}
          </h2>
        )}

        {children}
      </div>
    </div>
  );
}
