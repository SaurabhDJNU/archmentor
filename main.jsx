import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider } from './auth.jsx';
import Layout from './Layout.jsx';
import Home from './Home.jsx';
import Mentors from './Mentors.jsx';
import MentorProfile from './MentorProfile.jsx';
import Sessions from './Sessions.jsx';
import Journal from './Journal.jsx';
import Post from './Post.jsx';
import Videos from './Videos.jsx';
import Ask from './Ask.jsx';
import Write from './Write.jsx';
import { Login, Signup, ForgotPassword, ResetPassword } from './AccountPages.jsx';
import NotFound from './NotFound.jsx';
// The dashboard and editor load only when opened, so public pages stay light.
const Dashboard = lazy(() => import('./Dashboard.jsx'));
const Editor = lazy(() => import('./Editor.jsx'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="mentors" element={<Mentors />} />
            <Route path="mentors/:id" element={<MentorProfile />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="journal" element={<Journal />} />
            <Route path="journal/:slug" element={<Post />} />
            <Route path="videos" element={<Videos />} />
            <Route path="ask" element={<Ask />} />
            <Route path="write" element={<Write />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="dashboard" element={<Suspense fallback={<p className="wrap spinner">Loading…</p>}><Dashboard /></Suspense>} />
            <Route path="editor/:id" element={<Suspense fallback={<p className="wrap spinner">Loading…</p>}><Editor /></Suspense>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
