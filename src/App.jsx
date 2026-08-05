/* eslint-disable no-unused-vars */
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppNavigation from './components/router/AppNavigation'

const routerBasename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

export default function App() {

  return (
    <>
      <BrowserRouter basename={routerBasename === "/" ? undefined : routerBasename}>
        <AppNavigation/>
      </BrowserRouter>
    </>
  )
}
