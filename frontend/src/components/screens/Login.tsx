import { useState } from 'react';
import { User, Shield, Factory, TrendingUp, ChevronRight } from 'lucide-react';

interface LoginProps {
  onLogin: (role: string) => void;
}

const roles = [
  {
    id: 'ceo',
    label: 'CEO / COO',
    subtitle: 'Executive Summary & Strategic Oversight',
    icon: Shield,
    color: 'from-orange-500 to-orange-600',
    hoverColor: 'hover:border-orange-400',
    defaultScreen: 'executive',
  },
  {
    id: 'planning',
    label: 'Sales & Planning',
    subtitle: 'Demand Forecasting & Recipe Translation',
    icon: TrendingUp,
    color: 'from-brown-600 to-brown-700',
    hoverColor: 'hover:border-brown-400',
    defaultScreen: 'demand',
  },
  {
    id: 'operations',
    label: 'Operations',
    subtitle: 'Mill Scheduling & Runtime Management',
    icon: Factory,
    color: 'from-amber-500 to-amber-600',
    hoverColor: 'hover:border-amber-400',
    defaultScreen: 'capacity',
  },
];

export default function Login({ onLogin }: LoginProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole) {
      onLogin(selectedRole);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brown-50 via-white to-orange-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background wheat decoration */}
      <div className="fixed top-0 right-0 h-screen w-[600px] pointer-events-none z-0 flex items-start justify-start" style={{ opacity: 0.15 }}>
        <img
          src="/Wheat_grain2.svg"
          alt=""
          className="h-[100%] w-auto object-contain max-w-full"
          style={{ filter: 'sepia(50%) saturate(80%) brightness(0.9)', transform: 'rotate(90deg)' }}
        />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-16 h-16 flex-shrink-0">
              <img src="/logo/MC4_Logo.jpeg" alt="MC4 Logo" className="w-full h-full object-contain rounded-lg shadow-md" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-brown-800">MC4 Enterprise Planning</h1>
          <p className="text-sm text-brown-600 mt-2">AI-Powered Command Center</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-brown-200 p-8">
          <form onSubmit={handleLogin}>
            {/* Username */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-brown-700 mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brown-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-2.5 border border-brown-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-brown-700 mb-1.5">Password</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brown-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-4 py-2.5 border border-brown-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-brown-700 mb-3">Select Your Role</label>
              <div className="space-y-2">
                {roles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`w-full flex items-center space-x-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : `border-brown-200 bg-white ${role.hoverColor} hover:bg-brown-50`
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-semibold text-brown-800">{role.label}</div>
                        <div className="text-xs text-brown-500">{role.subtitle}</div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                          <ChevronRight className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={!selectedRole}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
                selectedRole
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl'
                  : 'bg-brown-300 cursor-not-allowed'
              }`}
            >
              <span>Sign In</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-brown-500 mt-6">
          MC4 Enterprise Planning Platform &bull; Vision 2030
        </p>
      </div>
    </div>
  );
}
