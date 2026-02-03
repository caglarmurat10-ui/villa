"use client";

import { motion } from "framer-motion";

interface DashboardProps {
    stats: {
        brut: number;
        comm: number;
        net: number;
    }
}

export default function Dashboard({ stats }: DashboardProps) {
    return (
        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-4 rounded-2xl border-b-2 border-emerald-500 bg-gray-900/50"
            >
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Brüt</p>
                <p className="text-sm font-bold text-emerald-400">
                    ₺{stats.brut.toLocaleString('tr-TR')}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel p-4 rounded-2xl border-b-2 border-amber-500 bg-gray-900/50"
            >
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Komisyon</p>
                <p className="text-sm font-bold text-amber-400">
                    ₺{stats.comm.toLocaleString('tr-TR')}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel p-4 rounded-2xl border-b-2 border-rose-500 bg-gray-900/50"
            >
                <p className="text-[10px] text-gray-400 uppercase font-semibold">Net Kar</p>
                <p className="text-sm font-bold text-rose-400">
                    ₺{stats.net.toLocaleString('tr-TR')}
                </p>
            </motion.div>
        </div>
    );
}
