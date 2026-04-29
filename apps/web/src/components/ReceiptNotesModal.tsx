'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Props {
	initialValue: string;
	productName: string | null;
	onClose: () => void;
	onSave: (value: string) => void;
}

export function ReceiptNotesModal({
	initialValue,
	productName,
	onClose,
	onSave,
}: Props) {
	const [value, setValue] = useState(initialValue);
	const ref = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		const t = setTimeout(() => {
			const el = ref.current;
			if (el) {
				el.focus();
				const len = el.value.length;
				el.setSelectionRange(len, len);
			}
		}, 30);
		return () => clearTimeout(t);
	}, []);

	function commit() {
		onSave(value.trim());
		onClose();
	}

	return (
		<div
			className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
			onClick={onClose}
		>
			<div
				className="bg-surface border border-border rounded-xl w-full max-w-md"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="px-5 py-3 border-b border-border flex items-center justify-between">
					<div className="min-w-0">
						<h2 className="text-base font-semibold">Catatan</h2>
						{productName && (
							<p className="text-xs text-muted truncate">{productName}</p>
						)}
					</div>
					<button
						onClick={onClose}
						className="p-1 rounded hover:bg-bg"
						aria-label="Tutup"
					>
						<X size={18} />
					</button>
				</div>

				<div className="p-5 space-y-4 text-sm">
					<textarea
						ref={ref}
						value={value}
						maxLength={500}
						rows={4}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Escape') {
								e.preventDefault();
								onClose();
							} else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								commit();
							}
						}}
						placeholder="cth: warna hitam, campur, dsb"
						className="w-full px-3 py-2 rounded-lg border border-border bg-bg focus:outline-none focus:border-border2 resize-none text-base"
					/>
					<div className="flex justify-between items-center text-xs text-muted">
						<span>{value.length}/500</span>
						<span className="hidden sm:inline">⌘/Ctrl+Enter simpan</span>
					</div>

					<div className="flex gap-2 pt-2">
						<button
							onClick={onClose}
							className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-bg"
						>
							Batal
						</button>
						<button
							onClick={commit}
							className="flex-1 bg-text text-surface px-4 py-2 rounded-lg font-medium hover:opacity-90"
						>
							Simpan
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
