import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  const [bins, setBins] = useState([]);
  const [activities, setActivities] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);

  // State สำหรับค้นหารหัสโค้ดหน้ายืนยัน
  const [searchCode, setSearchCode] = useState('');

  // State สำหรับแก้ไขโพสต์ชุมชน
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // State สำหรับดูและลบคอมเมนต์
  const [viewingPostComments, setViewingPostComments] = useState(null);
  const [postCommentsList, setPostCommentsList] = useState([]);

  // State สำหรับแก้ไข / เพิ่มของรางวัล (Rewards Modal)
  const [editingReward, setEditingReward] = useState(null);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [rewardForm, setRewardForm] = useState({ name: '', pointsCost: 0, totalQuantity: 0, claimedQuantity: 0 });

  useEffect(() => {
    let unsubscribeBins = () => {};
    let unsubscribeActivities = () => {};
    let unsubscribeUsers = () => {};
    let unsubscribeRewards = () => {};
    let unsubscribeRedemptions = () => {};
    let unsubscribeCommunity = () => {};

    try {
      // 1. โหลดข้อมูลถังขยะ (bins)
      const binsRef = collection(db, 'bins');
      unsubscribeBins = onSnapshot(binsRef, (snapshot) => {
        const binsList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            fillLevel: data.fillLevel !== undefined ? Number(data.fillLevel) : 0
          };
        });
        setBins(binsList);

        // 2. โหลดข้อมูลผู้ใช้ (users) พร้อมดึงรูปโปรไฟล์
        const usersRef = collection(db, 'users');
        unsubscribeUsers = onSnapshot(usersRef, (userSnapshot) => {
          const usersData = {};
          const usersList = userSnapshot.docs.map(doc => {
            const uData = doc.data();
            const userName = uData.name || uData.fullName || uData.displayName || uData.username || uData.email || 'ผู้ใช้งาน';
            const userAvatar = uData.profileImage || uData.photoURL || uData.avatar || uData.image || uData.img || null;
            
            usersData[doc.id] = { name: userName, avatar: userAvatar };
            return {
              id: doc.id,
              ...uData,
              displayName: userName,
              avatar: userAvatar,
              totalPoints: Number(uData.points ?? uData.totalPoints ?? uData.score ?? 0)
            };
          });
          setUsersMap(usersData);
          setUsers(usersList);

          // 3. โหลดประวัติกิจกรรม (activities)
          const activitiesRef = collection(db, 'activities');
          const qAct = query(activitiesRef, orderBy('timestamp', 'desc'), limit(20));
          unsubscribeActivities = onSnapshot(qAct, (actSnapshot) => {
            const activitiesData = actSnapshot.docs.map(actDoc => {
              const actData = actDoc.id ? { id: actDoc.id, ...actDoc.data() } : actDoc.data();
              
              let realUserName = 'ผู้ใช้งาน';
              let realUserAvatar = null;
              if (actData.userId && usersData[actData.userId]) {
                realUserName = usersData[actData.userId].name;
                realUserAvatar = usersData[actData.userId].avatar;
              } else {
                realUserName = actData.userName || actData.name || 'ผู้ใช้งาน';
                realUserAvatar = actData.userAvatar || actData.avatar || actData.image || null;
              }

              let rawPoints = actData.points ?? actData.Points ?? actData.point ?? actData.Point ?? actData.score ?? actData.Score ?? 0;
              if (typeof rawPoints === 'object' && rawPoints !== null) {
                rawPoints = rawPoints.value || rawPoints.points || Object.values(rawPoints)[0] || 0;
              }
              const displayPoints = !isNaN(Number(rawPoints)) ? Number(rawPoints) : 0;

              return {
                ...actData,
                displayUserName: realUserName,
                displayUserAvatar: realUserAvatar,
                displayPoints: displayPoints
              };
            });
            setActivities(activitiesData);

            // 4. โหลดของรางวัล (rewards)
            const rewardsRef = collection(db, 'rewards');
            unsubscribeRewards = onSnapshot(rewardsRef, (rewSnapshot) => {
              const rewardsList = rewSnapshot.docs.map(doc => {
                const rData = doc.data();
                return {
                  id: doc.id,
                  ...rData,
                  displayName: rData.name || rData.title || 'ของรางวัล',
                  displayPoints: Number(rData.pointsCost ?? rData.points ?? rData.cost ?? 0),
                  totalQuantity: Number(rData.totalQuantity ?? rData.stock ?? rData.quantity ?? 0),
                  claimedQuantity: Number(rData.claimedQuantity ?? 0)
                };
              });
              rewardsList.sort((a, b) => b.displayPoints - a.displayPoints);
              setRewards(rewardsList);

              // 5. โหลดประวัติการแลกของรางวัล (redemptions)
              const redemptionsRef = collection(db, 'redemptions');
              const qRed = query(redemptionsRef, orderBy('createdAt', 'desc'), limit(50));
              unsubscribeRedemptions = onSnapshot(qRed, (redSnapshot) => {
                const redList = redSnapshot.docs.map(doc => {
                  const rData = doc.data();
                  let rUserName = 'ผู้ใช้งาน';
                  let rUserAvatar = null;
                  if (rData.userId && usersData[rData.userId]) {
                    rUserName = usersData[rData.userId].name;
                    rUserAvatar = usersData[rData.userId].avatar;
                  } else {
                    rUserName = rData.userName || 'ผู้ใช้งาน';
                    rUserAvatar = rData.userAvatar || rData.avatar || null;
                  }

                  let createdAtDate = null;
                  let formattedDate = '-';
                  if (rData.createdAt) {
                    createdAtDate = rData.createdAt.toDate ? rData.createdAt.toDate() : new Date(rData.createdAt);
                    if (!isNaN(createdAtDate)) {
                      formattedDate = createdAtDate.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
                    }
                  }

                  let isExpired = false;
                  if (createdAtDate && !isNaN(createdAtDate)) {
                    const expireDate = new Date(createdAtDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    if (new Date() > expireDate) {
                      isExpired = true;
                    }
                  }

                  const isUsed = rData.used === true;

                  return {
                    id: doc.id,
                    ...rData,
                    displayUserName: rUserName,
                    displayUserAvatar: rUserAvatar,
                    displayRewardName: rData.rewardName || rData.rewardTitle || rData.title || 'ของรางวัล',
                    displayPoints: Number(rData.pointsCost ?? rData.points ?? 0),
                    displayCode: rData.code || rData.redeemCode || '-',
                    displayUsed: isUsed,
                    displayDate: formattedDate,
                    isExpired: isExpired
                  };
                });
                setRedemptions(redList);

                // 6. โหลดโพสต์ชุมชน (community_posts)
                const communityRef = collection(db, 'community_posts');
                const qCom = query(communityRef, orderBy('createdAt', 'desc'), limit(20));
                unsubscribeCommunity = onSnapshot(qCom, (comSnapshot) => {
                  const comList = comSnapshot.docs.map(doc => {
                    const cData = doc.data();
                    
                    let cUserName = cData.userName || 'ผู้ใช้งาน';
                    let cUserAvatar = cData.userProfileImage || cData.userAvatar || cData.avatar || null;

                    if (cData.userId && usersData[cData.userId]) {
                      if (!cUserName || cUserName === 'ผู้ใช้งาน') cUserName = usersData[cData.userId].name;
                      if (!cUserAvatar) cUserAvatar = usersData[cData.userId].avatar;
                    }

                    let postImage = null;
                    if (cData.imageBase64) {
                      postImage = cData.imageBase64.startsWith('data:image') 
                        ? cData.imageBase64 
                        : `data:image/jpeg;base64,${cData.imageBase64}`;
                    } else if (cData.image || cData.imageUrl) {
                      postImage = cData.image || cData.imageUrl;
                    }

                    return {
                      id: doc.id,
                      ...cData,
                      displayUserName: cUserName,
                      displayUserAvatar: cUserAvatar,
                      displayTitle: cData.title || '-',
                      displayDescription: cData.description || cData.content || cData.text || '-',
                      displayImage: postImage,
                      displayLikes: Number(cData.likes ?? cData.likeCount ?? 0),
                      displayComments: Number(cData.commentCount ?? cData.commentsCount ?? 0)
                    };
                  });
                  setCommunityPosts(comList);
                  setLoading(false);
                });
              });
            });
          });
        });
      });
    } catch (err) {
      console.error("Firestore connection error:", err);
      setLoading(false);
    }

    return () => {
      unsubscribeBins();
      unsubscribeActivities();
      unsubscribeUsers();
      unsubscribeRewards();
      unsubscribeRedemptions();
      unsubscribeCommunity();
    };
  }, []);

  const handleClearBin = async (binId) => {
    try {
      const binRef = doc(db, 'bins', binId);
      await updateDoc(binRef, { fillLevel: 0 });
    } catch (error) {
      console.error("Error clearing bin:", error);
      alert('เกิดข้อผิดพลาดในการรีเซ็ตถังขยะ');
    }
  };

  const handleVerifyRedemptionCode = async (redemptionId) => {
    if (window.confirm('คุณต้องการยืนยันการใช้โค้ดรางวัลนี้ใช่หรือไม่?')) {
      try {
        const redRef = doc(db, 'redemptions', redemptionId);
        await updateDoc(redRef, {
          used: true
        });
        alert('ยืนยันรหัสโค้ดสำเร็จ!');
      } catch (error) {
        console.error("Error verifying code:", error);
        alert('เกิดข้อผิดพลาดในการยืนยันโค้ด');
      }
    }
  };

  const handleUpdatePost = async (e) => {
    e.preventDefault();
    if (!editingPost) return;
    try {
      const postRef = doc(db, 'community_posts', editingPost.id);
      await updateDoc(postRef, {
        title: editTitle,
        description: editDescription
      });
      setEditingPost(null);
      setEditTitle('');
      setEditDescription('');
      alert('อัปเดตโพสต์สำเร็จ!');
    } catch (error) {
      console.error("Error updating post:", error);
      alert('เกิดข้อผิดพลาดในการแก้ไขโพสต์');
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('คุณต้องการลบโพสต์นี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'community_posts', postId));
        alert('ลบโพสต์สำเร็จ!');
      } catch (error) {
        console.error("Error deleting post:", error);
        alert('เกิดข้อผิดพลาดในการลบโพสต์');
      }
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (window.confirm('คุณต้องการลบคอมเมนต์นี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'community_posts', postId, 'comments', commentId));
        
        const postRef = doc(db, 'community_posts', postId);
        const targetPost = communityPosts.find(p => p.id === postId);
        if (targetPost) {
          const newCount = Math.max(0, (targetPost.displayComments || 1) - 1);
          await updateDoc(postRef, { commentCount: newCount });
        }

        alert('ลบคอมเมนต์สำเร็จ!');
      } catch (error) {
        console.error("Error deleting comment:", error);
        alert('เกิดข้อผิดพลาดในการลบคอมเมนต์');
      }
    }
  };

  const handleOpenCommentsModal = (post) => {
    setViewingPostComments(post);
    const commentsRef = collection(db, 'community_posts', post.id, 'comments');
    const qComments = query(commentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(qComments, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPostCommentsList(comments);
    });

    return () => unsubscribe();
  };

  const handleSaveReward = async (e) => {
    e.preventDefault();
    try {
      if (isAddingReward) {
        await addDoc(collection(db, 'rewards'), {
          name: rewardForm.name,
          pointsCost: Number(rewardForm.pointsCost),
          totalQuantity: Number(rewardForm.totalQuantity),
          claimedQuantity: Number(rewardForm.claimedQuantity),
          createdAt: new Date()
        });
        alert('เพิ่มของรางวัลใหม่สำเร็จ!');
      } else if (editingReward) {
        const rewardRef = doc(db, 'rewards', editingReward.id);
        await updateDoc(rewardRef, {
          name: rewardForm.name,
          pointsCost: Number(rewardForm.pointsCost),
          totalQuantity: Number(rewardForm.totalQuantity),
          claimedQuantity: Number(rewardForm.claimedQuantity)
        });
        alert('อัปเดตของรางวัลสำเร็จ!');
      }
      setEditingReward(null);
      setIsAddingReward(false);
      setRewardForm({ name: '', pointsCost: 0, totalQuantity: 0, claimedQuantity: 0 });
    } catch (error) {
      console.error("Error saving reward:", error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลของรางวัล');
    }
  };

  const handleDeleteReward = async (rewardId) => {
    if (window.confirm('คุณต้องการลบของรางวัลนี้ใช่หรือไม่?')) {
      try {
        await deleteDoc(doc(db, 'rewards', rewardId));
        alert('ลบของรางวัลสำเร็จ!');
      } catch (error) {
        console.error("Error deleting reward:", error);
        alert('เกิดข้อผิดพลาดในการลบของรางวัล');
      }
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (email && password) setIsLoggedIn(true);
  };

  const UserAvatar = ({ avatar, name }) => {
    if (avatar) {
      return (
        <img 
          src={avatar} 
          alt={name} 
          className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm"
        />
      );
    }
    return (
      <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm shadow-sm">
        {name ? name.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
              <span className="text-3xl">♻️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">binsort Admin Panel</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl"
              placeholder="Email"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-xl"
              placeholder="Password"
            />
            <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-xl">
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between p-4 border-r border-slate-800">
        <div>
          <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-800 mb-6">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              ♻️
            </div>
            <div>
              <h2 className="font-bold text-white text-lg leading-none">binsort</h2>
              <span className="text-xs text-emerald-400 font-medium">Admin Management</span>
            </div>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              📊 แดชบอร์ด (Dashboard)
            </button>
            <button
              onClick={() => setActiveTab('bins')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'bins' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🗑️ จัดการจุดถังขยะ
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'users' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              👥 ผู้ใช้งาน & แต้มสะสม
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'rewards' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🎁 ของรางวัล & การแลก
            </button>
            <button
              onClick={() => setActiveTab('verify')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'verify' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ✅ ยืนยันโค้ดรางวัล (7 วัน)
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'community' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              💬 จัดการโพสต์ชุมชน
            </button>
          </nav>
        </div>

        {/* ส่วนแสดงชื่อแอดมินที่ล็อกอิน & ปุ่มออกจากระบบ */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-2 py-2 bg-slate-800/60 rounded-xl">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                A
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-white truncate">Administrator</p>
                <p className="text-xs text-slate-400 truncate">{email || 'admin@binsort.com'}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsLoggedIn(false)} 
              title="ออกจากระบบ"
              className="p-2 ml-1 bg-slate-700/60 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 rounded-lg transition-colors shrink-0 flex items-center gap-1 text-xs font-medium"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'ภาพรวมระบบ (Overview)'}
              {activeTab === 'bins' && 'จัดการจุดถังขยะ (Bins Management)'}
              {activeTab === 'users' && 'ผู้ใช้งาน & แต้มสะสม (Users & Points)'}
              {activeTab === 'rewards' && 'รายการของรางวัล & ประวัติการแลก (Rewards & Redemptions)'}
              {activeTab === 'verify' && 'ระบบยืนยันรหัสโค้ดรางวัล (ภายใน 7 วัน)'}
              {activeTab === 'community' && 'จัดการโพสต์ชุมชน (Community Posts)'}
            </h1>
            <p className="text-xs text-slate-500">เชื่อมต่อข้อมูลจริงจาก Firebase Firestore</p>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">ประวัติกิจกรรมทั้งหมด</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{activities.length} <span className="text-sm font-normal text-slate-500">รายการ</span></h3>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-2xl">♻️</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">จุดถังขยะทั้งหมด</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{bins.length} <span className="text-sm font-normal text-slate-500">จุด</span></h3>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">🗑️</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">ผู้ใช้งานทั้งหมด</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{users.length} <span className="text-sm font-normal text-slate-500">คน</span></h3>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-2xl">👥</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 font-medium">โพสต์ชุมชนทั้งหมด</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1">{communityPosts.length} <span className="text-sm font-normal text-slate-500">โพสต์</span></h3>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-2xl">💬</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <h3 className="font-bold text-slate-800 text-lg mb-4">ประวัติกิจกรรมล่าสุด</h3>
                  {loading ? (
                    <p className="text-sm text-slate-400 py-4">กำลังโหลดข้อมูล...</p>
                  ) : activities.length === 0 ? (
                    <p className="text-sm text-slate-400 py-4">ยังไม่มีข้อมูลใน Collection 'activities'</p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b text-xs font-semibold text-slate-400">
                          <th className="pb-3">ชื่อผู้ใช้</th>
                          <th className="pb-3">ประเภท</th>
                          <th className="pb-3">ถังที่ทิ้ง</th>
                          <th className="pb-3">แต้ม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-sm">
                        {activities.map((item) => {
                          let typeText = '-';
                          if (Array.isArray(item.binTypes)) {
                            typeText = item.binTypes.join(', ');
                          } else if (item.binTypes && typeof item.binTypes === 'object') {
                            typeText = Object.values(item.binTypes).join(', ');
                          } else if (item.title) {
                            typeText = item.title;
                          } else if (item.type) {
                            typeText = item.type;
                          }

                          let detailText = item.detail || item.binName || item.location || '-';

                          return (
                            <tr key={item.id}>
                              <td className="py-3 font-medium text-slate-700 flex items-center gap-3">
                                <UserAvatar avatar={item.displayUserAvatar} name={item.displayUserName} />
                                {item.displayUserName}
                              </td>
                              <td className="py-3 text-slate-700 font-medium">{typeText}</td>
                              <td className="py-3 text-slate-600">{detailText}</td>
                              <td className="py-3 font-semibold text-emerald-600">+{item.displayPoints} pts</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <h3 className="font-bold text-slate-800 text-lg">สถานะความจุถังขยะ</h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {bins.length === 0 ? (
                      <p className="text-sm text-slate-400">ยังไม่มีข้อมูลใน Collection 'bins'</p>
                    ) : (
                      bins.map((bin) => {
                        const level = bin.fillLevel;
                        const isFull = level >= 80;
                        return (
                          <div key={bin.id} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-slate-700">{bin.name || bin.id}</span>
                              <span className={`font-bold ${isFull ? 'text-rose-500' : 'text-emerald-500'}`}>{level}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className={`h-full ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${level}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bins' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">รายการจุดติดตั้งถังขยะทั้งหมด ({bins.length})</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bins.map((bin) => (
                  <div key={bin.id} className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-slate-800">{bin.name || bin.id}</h4>
                      <p className="text-xs text-slate-500 mt-1">ประเภท: {bin.type || '-'}</p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span className="text-slate-500">ความจุ</span>
                          <span className="font-bold text-emerald-600">{bin.fillLevel}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${bin.fillLevel}%` }}></div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-end">
                      <button 
                        onClick={() => handleClearBin(bin.id)}
                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        🧹 เคลียร์ถัง (รีเซ็ตเป็น 0%)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 text-lg mb-4">รายชื่อผู้ใช้งาน & คะแนนรวมสะสม ({users.length})</h3>
              {users.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">ยังไม่มีข้อมูลใน Collection 'users'</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-xs font-semibold text-slate-400">
                      <th className="pb-3">ชื่อผู้ใช้ (Name)</th>
                      <th className="pb-3">อีเมล (Email)</th>
                      <th className="pb-3 text-right">คะแนนรวมสะสม (Total Points)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-3 font-medium text-slate-700 flex items-center gap-3">
                          <UserAvatar avatar={user.avatar} name={user.displayName} />
                          {user.displayName}
                        </td>
                        <td className="py-3 text-slate-500">{user.email || '-'}</td>
                        <td className="py-3 font-bold text-emerald-600 text-right">{user.totalPoints} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800 text-lg">รายการของรางวัลทั้งหมดในระบบ ({rewards.length})</h3>
                  <button
                    onClick={() => {
                      setIsAddingReward(true);
                      setEditingReward(null);
                      setRewardForm({ name: '', pointsCost: 0, totalQuantity: 0, claimedQuantity: 0 });
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    + เพิ่มของรางวัลใหม่
                  </button>
                </div>
                {rewards.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">ยังไม่มีข้อมูลของรางวัลในระบบ</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rewards.map((reward) => (
                      <div key={reward.id} className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-slate-800 text-base">{reward.displayName}</h4>
                          <div className="mt-2 space-y-1 text-xs text-slate-500">
                            <p>ใช้แต้มแลก: <span className="font-bold text-emerald-600">{reward.displayPoints} pts</span></p>
                            <p>จำนวนทั้งหมด: <span className="font-medium text-slate-700">{reward.totalQuantity} ชิ้น</span></p>
                            <p>แลกไปแล้ว: <span className="font-medium text-slate-700">{reward.claimedQuantity} ชิ้น</span></p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setIsAddingReward(false);
                              setEditingReward(reward);
                              setRewardForm({
                                name: reward.name || reward.title || '',
                                pointsCost: reward.displayPoints,
                                totalQuantity: reward.totalQuantity,
                                claimedQuantity: reward.claimedQuantity
                              });
                            }}
                            className="bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            onClick={() => handleDeleteReward(reward.id)}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            🗑️ ลบ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal สำหรับเพิ่ม/แก้ไขของรางวัล */}
              {(isAddingReward || editingReward) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
                    <h3 className="font-bold text-slate-800 text-lg">
                      {isAddingReward ? 'เพิ่มของรางวัลใหม่' : 'แก้ไขข้อมูลของรางวัล'}
                    </h3>
                    <form onSubmit={handleSaveReward} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">ชื่อของรางวัล</label>
                        <input
                          type="text"
                          required
                          value={rewardForm.name}
                          onChange={(e) => setRewardForm({ ...rewardForm, name: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-sm"
                          placeholder="เช่น แก้วน้ำรักษ์โลก"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">คะแนนที่ใช้แลก (Points Cost)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={rewardForm.pointsCost}
                          onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">จำนวนทั้งหมดในสต็อก (Total Quantity)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={rewardForm.totalQuantity}
                          onChange={(e) => setRewardForm({ ...rewardForm, totalQuantity: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">จำนวนที่แลกไปแล้ว (Claimed Quantity)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={rewardForm.claimedQuantity}
                          onChange={(e) => setRewardForm({ ...rewardForm, claimedQuantity: e.target.value })}
                          className="w-full px-3 py-2 border rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => { setIsAddingReward(false); setEditingReward(null); }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"
                        >
                          บันทึก
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'verify' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">ตรวจสอบและยืนยันรหัสโค้ดรางวัล</h3>
                  <p className="text-xs text-slate-500">รหัสโค้ดจะหมดอายุภายใน 7 วันหลังจากวันที่แลก</p>
                </div>
                <div className="w-full md:w-72">
                  <input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    placeholder="🔍 ค้นหาด้วยรหัสโค้ด..."
                    className="w-full px-4 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              {redemptions.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">ยังไม่มีประวัติการแลกของรางวัลในระบบ</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b text-xs font-semibold text-slate-400">
                        <th className="pb-3">ผู้แลกรางวัล</th>
                        <th className="pb-3">ของรางวัล</th>
                        <th className="pb-3">รหัสโค้ด (Code)</th>
                        <th className="pb-3">วันที่แลก</th>
                        <th className="pb-3">สถานะ (Used)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {redemptions
                        .filter(item => searchCode === '' || item.displayCode.toLowerCase().includes(searchCode.toLowerCase()))
                        .map((item) => (
                          <tr key={item.id}>
                            <td className="py-3 font-medium text-slate-700 flex items-center gap-3">
                              <UserAvatar avatar={item.displayUserAvatar} name={item.displayUserName} />
                              {item.displayUserName}
                            </td>
                            <td className="py-3 text-slate-700">{item.displayRewardName}</td>
                            <td className="py-3 font-mono font-bold text-emerald-600">{item.displayCode}</td>
                            <td className="py-3 text-slate-500 text-xs">{item.displayDate}</td>
                            <td className="py-3">
                              {item.displayUsed ? (
                                <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-semibold">ใช้งานแล้ว (Used)</span>
                              ) : item.isExpired ? (
                                <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full text-xs font-semibold">หมดอายุ (เกิน 7 วัน)</span>
                              ) : (
                                <span className="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-xs font-semibold">รอการใช้งาน</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 text-lg mb-6">จัดการโพสต์ชุมชนทั้งหมด ({communityPosts.length})</h3>
                {communityPosts.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4">ยังไม่มีโพสต์ในชุมชน</p>
                ) : (
                  <div className="space-y-4">
                    {communityPosts.map((post) => (
                      <div key={post.id} className="border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <UserAvatar avatar={post.displayUserAvatar} name={post.displayUserName} />
                            <div>
                              <h4 className="font-bold text-slate-800">{post.displayUserName}</h4>
                              <p className="text-[10px] text-slate-400">ID โพสต์: {post.id}</p>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-bold text-slate-700 text-base">{post.displayTitle}</h5>
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">{post.displayDescription}</p>
                          </div>
                          {post.displayImage && (
                            <img src={post.displayImage} alt="Post image" className="w-32 h-32 object-cover rounded-xl border border-slate-100 mt-2" />
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                            <span>❤️ {post.displayLikes} ไลค์</span>
                            <span>💬 {post.displayComments} คอมเมนต์</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            onClick={() => handleOpenCommentsModal(post)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            💬 จัดการคอมเมนต์ ({post.displayComments})
                          </button>
                          <button
                            onClick={() => {
                              setEditingPost(post);
                              setEditTitle(post.title || '');
                              setEditDescription(post.description || post.content || post.text || '');
                            }}
                            className="bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            🗑️ ลบโพสต์
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal แก้ไขโพสต์ชุมชน */}
              {editingPost && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
                    <h3 className="font-bold text-slate-800 text-lg">แก้ไขโพสต์ชุมชน</h3>
                    <form onSubmit={handleUpdatePost} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">หัวข้อโพสต์ (Title)</label>
                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">เนื้อหาโพสต์ (Description)</label>
                        <textarea
                          required
                          rows="4"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => setEditingPost(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"
                        >
                          บันทึกการแก้ไข
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal จัดการคอมเมนต์ภายในโพสต์ */}
              {viewingPostComments && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg">ความคิดเห็นในโพสต์</h3>
                        <p className="text-xs text-slate-400">"{viewingPostComments.displayTitle}"</p>
                      </div>
                      <button 
                        onClick={() => setViewingPostComments(null)}
                        className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      {postCommentsList.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีคอมเมนต์ในโพสต์นี้</p>
                      ) : (
                        postCommentsList.map((comm) => (
                          <div key={comm.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-start gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 text-xs">{comm.userName || comm.name || 'ผู้ใช้งาน'}</span>
                                <span className="text-[10px] text-slate-400">
                                  {comm.createdAt?.toDate ? comm.createdAt.toDate().toLocaleString('th-TH') : ''}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600">{comm.text || comm.content || comm.comment || '-'}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(viewingPostComments.id, comm.id)}
                              className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-2 py-1 rounded-lg text-xs font-medium transition-colors shrink-0"
                            >
                              🗑️ ลบ
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t">
                      <button
                        type="button"
                        onClick={() => setViewingPostComments(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
                      >
                        ปิดหน้าต่าง
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}