import logoRound from '../assets/logo-round.png'

// Logo thương hiệu chính thức: vòng tròn đỏ + ngôi nhà trắng + chữ "VẬT LIỆU NHÀ"
export function RoofMark({ className = 'h-8 w-8' }) {
  return <img src={logoRound} alt="Vật Liệu Nhà" className={`${className} object-contain`} />
}

export default function RoofLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-2">
      <RoofMark className={compact ? 'h-7 w-7' : 'h-8 w-8'} />
      <span className="text-[17px] font-extrabold uppercase tracking-wide text-gray-900">
        Vật Liệu Nhà
      </span>
    </div>
  )
}
