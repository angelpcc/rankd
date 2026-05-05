import { UserType } from '@/lib/supabase';

interface UserTypeSelectorProps {
  selected: UserType | null;
  onChange: (type: UserType) => void;
}

const types: { value: UserType; label: string; icon: string; desc: string; badge?: string }[] = [
  {
    value: 'fighter',
    label: 'Peleador',
    icon: 'ri-boxing-line',
    desc: 'Crea tu perfil deportivo, sube tu récord y encuentra oportunidades',
  },
  {
    value: 'promoter',
    label: 'Promotora',
    icon: 'ri-trophy-line',
    desc: 'Organiza eventos, publica combates y descubre nuevos talentos',
  },
  {
    value: 'gym',
    label: 'Gimnasio / Club',
    icon: 'ri-building-4-line',
    desc: 'Representa a tu gimnasio, busca sparrings y gestiona campamentos',
  },
  {
    value: 'manager',
    label: 'Manager',
    icon: 'ri-user-star-line',
    desc: 'Gestiona carreras de peleadores y conecta con promotoras',
  },
  {
    value: 'brand',
    label: 'Marca / Patrocinador',
    icon: 'ri-store-2-line',
    desc: 'Patrocina peleadores y eventos de élite en el deporte de contacto',
  },
];

export default function UserTypeSelector({ selected, onChange }: UserTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5">
      {types.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
            selected === t.value
              ? 'border-red-500 bg-red-500/10'
              : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'
          }`}
        >
          <div
            className={`w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${
              selected === t.value ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-300'
            }`}
          >
            <i className={`${t.icon} text-xl`}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`font-semibold text-sm ${selected === t.value ? 'text-red-400' : 'text-white'}`}>
                {t.label}
              </p>
              {t.badge && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{t.desc}</p>
          </div>
          {selected === t.value && (
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className="ri-check-line text-red-500 text-lg"></i>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
