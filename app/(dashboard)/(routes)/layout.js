import React from 'react'

function layout({children}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main>
        {children}
      </main>
    </div>
  )
}

export default layout