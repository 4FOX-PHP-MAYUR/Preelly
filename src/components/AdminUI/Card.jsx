import React from 'react'

function Card({ title, value, icon: Icon, className = '' }) {
  return (
    <div className={`rounded-2xl shadow-md bg-white p-6 transition-all duration-200 ease-in-out hover:shadow-lg ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        {Icon && (
          <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Icon className="h-6 w-6 text-indigo-600" />
          </div>
        )}
      </div>
    </div>
  )
}

export default Card

