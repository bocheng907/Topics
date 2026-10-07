import { Bell, Calendar, ChevronLeft, Eye, Flame, Heart, Home, Image as ImageIcon, Lightbulb, MessageCircle, MessageCircleHeart, MessageSquare, MoreHorizontal, Plus, Search, Send, Share2, ShoppingCart, Users } from 'lucide-react';
import React, { useState } from 'react';

// ==========================================
// 顏色常數與樣式設定
// ==========================================
const COLORS = {
  primary: '#2C3E50', // 深藍色
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#1F2937', // 深灰文字
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  inputBg: '#F3F4F6',
  white: '#FFFFFF',
  danger: '#E74C3C',
  heart: '#F472B6',

  // 分類顏色設定 (符合要求)
  categories: {
    '照護技巧': { main: '#4A90E2', bg: '#EBF3FC', icon: Lightbulb },
    '用品資源': { main: '#52B788', bg: '#EAF6EF', icon: ShoppingCart },
    '經驗交流': { main: '#F4A261', bg: '#FDF2E9', icon: MessageCircleHeart },
  }
};

// ==========================================
// Mock 資料
// ==========================================
const MOCK_POSTS = [
  {
    id: '1',
    category: '經驗交流',
    title: '照顧媽媽 5 年了，今天終於哭出來',
    preview: '看著她越來越不認得我，今天下午餵飯時她突然把碗打翻，我真的很無力...',
    content: '看著她越來越不認得我，今天下午餵飯時她突然把碗打翻，我一邊收一邊眼淚就掉下來了。這五年來我辭掉工作全職照顧，雖然有申請長照 2.0，但晚上的時間還是只能靠自己。\n\n我知道這不是她的錯，失智症讓她變成這樣，但真的覺得好累。有人也是這樣熬過來的嗎？',
    author: { name: '陳曉明', avatar: 'https://i.pravatar.cc/150?u=1' },
    time: '2 小時前',
    views: 1250,
    commentsCount: 24,
    likes: 85,
    isLiked: false,
  },
  {
    id: '2',
    category: '照護技巧',
    title: '怎麼幫爸爸翻身不會傷到他的肩膀？',
    preview: '最近爸爸長期臥床，護理師說要兩小時翻一次，但我每次翻他都會喊痛，請問有沒有什麼撇步？',
    content: '最近爸爸因為中風長期臥床，出院前護理師有交代要每兩小時翻身一次避免壓瘡。但我發現每次我出力幫他翻身時，他都會喊肩膀痛。\n\n我上網看了幾支影片，好像說要先曲起他的膝蓋，然後推骨盆？請問大家有沒有更實用的技巧或輔具推薦？',
    author: { name: '林太太', avatar: 'https://i.pravatar.cc/150?u=2' },
    time: '4 小時前',
    views: 842,
    commentsCount: 12,
    likes: 34,
    isLiked: true,
  },
  {
    id: '3',
    category: '用品資源',
    title: '南投 XX 藥局的成人尿布真的便宜！',
    preview: '分享一下，今天去補貨發現這家藥局的包大人一整箱才賣 1200，有需要的家屬可以去看看。',
    content: '分享一下，今天去補貨發現這家藥局的包大人（黏貼型，L號）一整箱才賣 1200！老闆說這是每個月的特價活動。如果有在南投市區附近的家屬可以去看看，省下不少耗材費！\n\n他們也有賣一些傷口敷料，價格也算公道。',
    author: { name: '王大衛', avatar: 'https://i.pravatar.cc/150?u=3' },
    time: '6 小時前',
    views: 1890,
    commentsCount: 30,
    likes: 120,
    isLiked: false,
  },
  {
    id: '4',
    category: '照護技巧',
    title: '餵藥時長輩一直吐出來怎麼辦',
    preview: '阿嬤最近吞嚥變差，每次餵藥都像打仗，磨成粉加在水裡她又嫌苦不喝...',
    content: '阿嬤最近吞嚥功能變差，每次餵藥都像打仗，原來的藥丸吞不下去。我請醫生開粉狀的，加在水裡她又嫌苦不喝。\n\n今天試了加在布丁裡，結果她吃兩口發現有藥味就全吐出來了。請問大家對於抗拒吃藥的長輩都怎麼處理？',
    author: { name: '李小姐', avatar: 'https://i.pravatar.cc/150?u=4' },
    time: '12 小時前',
    views: 520,
    commentsCount: 8,
    likes: 21,
    isLiked: false,
  },
  {
    id: '5',
    category: '用品資源',
    title: '網購看護墊推薦，含連結',
    preview: '試過很多牌子，這款真的最吸水又不回滲，而且蝦皮常有免運活動。',
    content: '之前因為爸爸會漏尿，晚上常要起來換床單，試過很多牌子的看護墊，不是太薄就是會破。最近在蝦皮買到一款藍色包裝的，真的最吸水又不回滲！\n\n趁著免運活動一次買了三箱，分享給也在為漏尿煩惱的家屬們。',
    author: { name: '阿信', avatar: 'https://i.pravatar.cc/150?u=5' },
    time: '1 天前',
    views: 3100,
    commentsCount: 45,
    likes: 210,
    isLiked: true,
  },
  {
    id: '6',
    category: '經驗交流',
    title: '跟外籍看護溝通的小訣竅',
    preview: '家裡剛請了印尼籍看護，語言不通真的好挫折，分享幾個實用方法。',
    content: '家裡剛請了印尼籍看護阿蒂，雖然仲介說她會一點中文，但實際上遇到照護細節還是很難溝通。\n\n後來我發現「Google 翻譯的語音功能」加上「親自示範一次並錄影給她看」是最有效的方法！現在她看著影片跟著做，錯誤率降低很多。',
    author: { name: '張先生', avatar: 'https://i.pravatar.cc/150?u=6' },
    time: '1 天前',
    views: 980,
    commentsCount: 15,
    likes: 67,
    isLiked: false,
  },
  {
    id: '7',
    category: '照護技巧',
    title: '臥床長輩的皮膚照護重點',
    preview: '長照2.0的居服員教我的，保持乾燥和適度保濕都很重要。',
    content: '長照2.0的居服員來洗澡時教我的。臥床長輩因為血液循環差，皮膚很容易脆弱。除了勤翻身，大便後一定要用溫水洗淨擦乾，然後塗上一層薄薄的凡士林或氧化鋅當隔離。\n\n千萬別用力擦拭，用點壓的方式把水分吸乾就好。',
    author: { name: '吳阿姨', avatar: 'https://i.pravatar.cc/150?u=7' },
    time: '2 天前',
    views: 654,
    commentsCount: 5,
    likes: 42,
    isLiked: false,
  },
  {
    id: '8',
    category: '用品資源',
    title: '二手輔具租借的資源整理',
    preview: '其實很多輪椅、氣墊床不用買新的，各縣市輔具中心都有租借服務。',
    content: '剛開始照顧時什麼都想買新的，後來發現其實很多輪椅、氣墊床不用買，各縣市的「輔具資源中心」都有二手租借服務，而且都有經過專業消毒。\n\n如果有低收或中低收身分，租金甚至可以全免。建議大家要買昂貴輔具前先打電話去問問看！',
    author: { name: '社工小林', avatar: 'https://i.pravatar.cc/150?u=8' },
    time: '2 天前',
    views: 4200,
    commentsCount: 52,
    likes: 380,
    isLiked: true,
  },
  {
    id: '9',
    category: '經驗交流',
    title: '感謝有這個平台，讓我不孤單',
    preview: '每天晚上睡前看大家的文章，才知道原來有這麼多人在經歷一樣的事。',
    content: '每天晚上照顧完爸爸睡覺後，滑滑大家的文章，才知道原來有這麼多人在經歷一樣的事情。\n\n看到有人生氣、有人崩潰、有人分享好物，覺得這條漫長的照顧路上好像多了一群戰友。謝謝大家無私的分享，我們一起加油！',
    author: { name: '陳曉明', avatar: 'https://i.pravatar.cc/150?u=1' },
    time: '3 天前',
    views: 1100,
    commentsCount: 33,
    likes: 156,
    isLiked: false,
  },
  {
    id: '10',
    category: '照護技巧',
    title: '如何判斷長輩是不是尿道感染？',
    preview: '分享上次送急診的經驗，原來發燒前會先出現這些症狀。',
    content: '分享上次送阿公去急診的經驗。尿道感染不一定會馬上發燒，如果有發現長輩突然變得很躁動、尿液味道變重、或是尿布上的顏色變深，就有可能是感染了。\n\n醫生說平常一定要多鼓勵喝水，如果吞嚥不好可以把水稍微增稠。',
    author: { name: '黃護理師', avatar: 'https://i.pravatar.cc/150?u=9' },
    time: '4 天前',
    views: 890,
    commentsCount: 9,
    likes: 72,
    isLiked: false,
  }
];

const MOCK_COMMENTS = [
  { id: 'c1', author: '林太太', avatar: 'https://i.pravatar.cc/150?u=2', time: '1 小時前', content: '我懂這種感覺，真的辛苦你了。你要記得先照顧好自己，找喘息服務幫忙。' },
  { id: 'c2', author: '王大衛', avatar: 'https://i.pravatar.cc/150?u=3', time: '45 分鐘前', content: '拍拍你，我照顧失智父親 3 年，他現在連我都打。真的很累，但我們只能盡力。' },
  { id: 'c3', author: '李小姐', avatar: 'https://i.pravatar.cc/150?u=4', time: '20 分鐘前', content: '如果不介意，可以去參加家屬支持團體，說出來心裡會好過很多。' },
];

const HOT_POSTS = MOCK_POSTS.slice(0, 4);

// ==========================================
// 共用元件：分類標籤
// ==========================================
const CategoryTag = ({ category }) => {
  const config = COLORS.categories[category] || { main: COLORS.textSecondary, bg: COLORS.border, icon: null };
  const IconComponent = config.icon;
  
  return (
    <div 
      className="inline-flex items-center px-2 py-1 rounded-[12px] text-xs font-semibold"
      style={{ backgroundColor: config.bg, color: config.main }}
    >
      {IconComponent && <IconComponent size={14} color={config.main} style={{ marginRight: 6 }} />}
      {category}
    </div>
  );
};

// ==========================================
// 頁面 1：主頁 (CommunityHome)
// ==========================================
function CommunityHome({ navigateTo, setPostDetailData }) {
  const [activeTab, setActiveTab] = useState('全部');
  const TABS = ['全部', '照護技巧', '用品資源', '經驗交流'];

  const filteredPosts = activeTab === '全部' 
    ? MOCK_POSTS 
    : MOCK_POSTS.filter(post => post.category === activeTab);

  const handlePostClick = (post) => {
    setPostDetailData(post);
    navigateTo('PostDetail');
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 bg-white border-b border-gray-100 z-10 sticky top-0">
        <h1 className="text-xl font-bold text-gray-800 tracking-wide">照顧者交流</h1>
        <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <Bell size={24} color={COLORS.text} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
        
        {/* 搜尋列 */}
        <div className="px-5 py-3 bg-white">
          <div className="flex items-center bg-[#F5F5F5] rounded-lg px-3 h-10 border border-transparent focus-within:border-gray-300 transition-colors">
            <Search size={20} color={COLORS.textLight} />
            <input 
              type="text"
              placeholder="搜尋照護資訊、用品推薦..."
              className="flex-1 ml-2 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>
        </div>

        {/* 🔥 本週熱門 (替換圖示) */}
        <div className="px-5 mt-4 mb-3">
          <div className="flex items-center gap-[6px]">
            <Flame size={16} color="#E74C3C" />
            <h2 className="text-sm font-bold text-gray-800">本週熱門</h2>
          </div>
        </div>
        <div className="flex overflow-x-auto hide-scrollbar px-5 pb-5 gap-4">
          {HOT_POSTS.map(post => {
            const config = COLORS.categories[post.category];
            return (
              <div 
                key={post.id} 
                onClick={() => handlePostClick(post)}
                className="w-60 p-4 rounded-[12px] flex flex-col justify-between shrink-0 cursor-pointer shadow-sm hover:shadow-md transition-shadow border border-gray-50"
                style={{ backgroundColor: config.bg }}
              >
                <div>
                  <CategoryTag category={post.category} />
                  <h3 className="text-[15px] font-bold text-gray-900 mt-2.5 mb-3 line-clamp-2 leading-snug">
                    {post.title}
                  </h3>
                </div>
                <div className="flex items-center gap-[6px] text-xs text-gray-500 font-medium">
                  <Eye size={14} color="#6B7280" />
                  {post.views} 觀看
                </div>
              </div>
            )
          })}
        </div>

        {/* 分類切換 */}
        <div className="px-5 mb-4 border-b border-gray-100 pb-2">
          <div className="flex overflow-x-auto hide-scrollbar gap-2">
            {TABS.map(tab => {
              const isActive = activeTab === tab;
              const config = tab !== '全部' ? COLORS.categories[tab] : { main: COLORS.primary };
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-9 px-4 rounded-full flex justify-center items-center shrink-0 transition-colors border ${
                    isActive ? 'border-transparent text-white font-bold' : 'bg-transparent border-gray-200 text-gray-500 hover:bg-gray-50 font-medium'
                  }`}
                  style={isActive ? { backgroundColor: config.main } : {}}
                >
                  <span className="text-sm">{tab}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 文章列表 */}
        <div className="px-5 flex flex-col gap-4 pb-10">
          {filteredPosts.map(post => (
            <div 
              key={post.id} 
              onClick={() => handlePostClick(post)}
              className="bg-white py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors -mx-5 px-5"
            >
              <div className="flex justify-between items-center mb-2">
                <CategoryTag category={post.category} />
                <span className="text-xs text-gray-400 font-medium">{post.time}</span>
              </div>
              
              <h3 className="text-base font-bold text-gray-900 mb-1.5 leading-snug line-clamp-2">
                {post.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-3 line-clamp-2">
                {post.preview}
              </p>
              
              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-2">
                  <img src={post.author.avatar} alt="avatar" className="w-6 h-6 rounded-full bg-gray-200 object-cover" />
                  <span className="text-xs text-gray-500 font-medium">{post.author.name}</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400 font-medium">
                  <div className="flex items-center gap-[6px]">
                    <Eye size={14} color="#6B7280" />
                    <span>{post.views}</span>
                  </div>
                  <div className="flex items-center gap-[6px]">
                    <MessageCircle size={14} color="#6B7280" />
                    <span>{post.commentsCount}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 浮動發文按鈕 (替換圖示) */}
      <button 
        onClick={() => navigateTo('CreatePost')}
        className="absolute bottom-[90px] right-5 w-14 h-14 rounded-full bg-[#2C3E50] text-white flex justify-center items-center shadow-[0_4px_12px_rgba(44,62,80,0.3)] hover:scale-105 active:scale-95 transition-transform z-20"
      >
        <Plus size={24} color="#FFFFFF" />
      </button>
    </div>
  );
}

// ==========================================
// 頁面 2：文章詳情頁 (PostDetail)
// ==========================================
function PostDetail({ navigateTo, postData }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [isLiked, setIsLiked] = useState(postData?.isLiked || false);
  const post = postData || MOCK_POSTS[0]; // 防呆

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigateTo('Home')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={26} color={COLORS.text} />
        </button>
        <button onClick={() => setModalVisible(true)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <MoreHorizontal size={24} color={COLORS.text} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
        {/* 內文區 */}
        <div className="p-5 pb-2">
          <div className="mb-3">
            <CategoryTag category={post.category} />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 leading-snug mb-4 tracking-wide">
            {post.title}
          </h1>
          
          <div className="flex items-center mb-5">
            <img src={post.author.avatar} alt="avatar" className="w-10 h-10 rounded-full bg-gray-200 object-cover mr-3" />
            <div>
              <div className="text-sm font-bold text-gray-900 mb-0.5">{post.author.name}</div>
              <div className="text-xs text-gray-400 font-medium">{post.time}</div>
            </div>
          </div>

          <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
        </div>

        <div className="h-px bg-gray-100 mx-5 my-4"></div>

        {/* 互動列 */}
        <div className="flex justify-between items-center px-5 py-2">
          <div className="flex gap-6">
            <button 
              onClick={() => setIsLiked(!isLiked)}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
            >
              <Heart size={22} color={isLiked ? COLORS.heart : COLORS.textSecondary} fill={isLiked ? COLORS.heart : 'none'} />
              <span className={`text-sm font-medium ${isLiked ? 'text-pink-400' : 'text-gray-500'}`}>
                {isLiked ? post.likes + 1 : post.likes}
              </span>
            </button>
            <button className="flex items-center gap-1.5 hover:opacity-70 transition-opacity">
              <MessageCircle size={22} color={COLORS.textSecondary} />
              <span className="text-sm font-medium text-gray-500">{post.commentsCount}</span>
            </button>
          </div>
          <button className="p-2 -mr-2 hover:bg-gray-50 rounded-full transition-colors">
            <Share2 size={20} color={COLORS.textSecondary} />
          </button>
        </div>

        <div className="h-2 bg-gray-50 w-full my-2 border-y border-gray-100"></div>

        {/* 留言區 */}
        <div className="p-5 pb-24">
          <h3 className="text-base font-bold text-gray-900 mb-5">留言 ({MOCK_COMMENTS.length})</h3>
          
          <div className="flex flex-col gap-5">
            {MOCK_COMMENTS.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <img src={comment.avatar} alt="avatar" className="w-8 h-8 rounded-full bg-gray-200 object-cover shrink-0" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[13px] font-bold text-gray-900">{comment.author}</span>
                    <span className="text-[11px] text-gray-400">{comment.time}</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-snug">
                    {comment.content}
                  </p>
                </div>
                <button className="pt-1 px-1 hover:opacity-70 self-start">
                  <Heart size={14} color={COLORS.textLight} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 留言輸入框 (固定底部) */}
      <div className="absolute bottom-0 w-full bg-white border-t border-gray-200 p-3 flex items-end gap-3 z-10">
        <textarea 
          placeholder="留個言鼓勵一下吧..."
          className="flex-1 bg-gray-100 rounded-[20px] px-4 py-2.5 text-[15px] text-gray-800 placeholder-gray-400 outline-none resize-none hide-scrollbar max-h-24 min-h-[40px]"
          rows="1"
        ></textarea>
        <button className="w-10 h-10 rounded-full bg-[#2C3E50] text-white flex justify-center items-center shrink-0 hover:bg-gray-800 transition-colors mb-0.5">
          <Send size={18} className="ml-1" />
        </button>
      </div>

      {/* 檢舉 Modal */}
      {modalVisible && <ReportModal onClose={() => setModalVisible(false)} />}
    </div>
  );
}

// ==========================================
// 頁面 3：發文頁 (CreatePost)
// ==========================================
function CreatePost({ navigateTo }) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const CATEGORIES = ['照護技巧', '用品資源', '經驗交流'];
  const isFormValid = selectedCategory !== '' && title.trim() !== '' && content.trim() !== '';

  const handlePublish = () => {
    if (!isFormValid) return;
    alert('✅ 文章已發布！');
    navigateTo('Home');
  };

  return (
    <div className="flex flex-col h-full bg-white relative animate-slideUp">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => navigateTo('Home')} className="px-2 py-1 text-gray-500 font-medium hover:bg-gray-50 rounded transition-colors">
          取消
        </button>
        <h1 className="text-[17px] font-bold text-gray-900 tracking-wide">發表文章</h1>
        <button 
          onClick={handlePublish}
          disabled={!isFormValid}
          className={`px-3 py-1.5 rounded font-bold transition-colors ${
            isFormValid ? 'text-[#4A90E2] hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          發布
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
        
        {/* 分類選擇 (替換圖示) */}
        <div className="flex gap-2 px-5 py-5">
          {CATEGORIES.map(cat => {
            const config = COLORS.categories[cat];
            const isSelected = selectedCategory === cat;
            const IconComponent = config.icon;
            
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 rounded-[10px] border transition-all ${
                  isSelected 
                    ? 'border-transparent text-white font-bold shadow-sm' 
                    : 'bg-white border-gray-200 text-gray-600 font-medium hover:bg-gray-50'
                }`}
                style={isSelected ? { backgroundColor: config.main } : { color: config.main, backgroundColor: config.bg, borderColor: 'transparent' }}
              >
                {IconComponent && <IconComponent size={14} color={isSelected ? '#FFFFFF' : config.main} />}
                <span className="text-[13px]">{cat}</span>
              </button>
            )
          })}
        </div>

        {/* 標題輸入 */}
        <div className="px-5">
          <input 
            type="text"
            placeholder="輸入標題..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-lg font-bold text-gray-900 placeholder-gray-300 outline-none pb-4 border-b border-gray-100"
            maxLength={50}
          />
        </div>

        {/* 內容輸入 */}
        <div className="px-5 py-4 flex-1 flex flex-col">
          <textarea 
            placeholder="分享你的照護經驗、用品推薦或心得..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full flex-1 min-h-[200px] text-base text-gray-800 placeholder-gray-400 outline-none resize-none leading-relaxed"
          ></textarea>
        </div>

        {/* 加入圖片 */}
        <div className="px-5 pb-5">
          <button className="w-full py-3.5 border border-dashed border-gray-300 rounded-[12px] flex justify-center items-center gap-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">
            <ImageIcon size={20} />
            <span className="text-[15px] font-medium">加入圖片</span>
          </button>
        </div>

        {/* 底部提示 */}
        <div className="bg-gray-50 py-4 px-6 flex justify-center items-center border-t border-gray-100 mt-auto">
          <p className="text-xs text-gray-400 font-medium text-center">
            本平台內容為使用者經驗分享，不能取代專業醫療建議
          </p>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 頁面 4：檢舉彈窗 (ReportModal)
// ==========================================
function ReportModal({ onClose }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherText, setOtherText] = useState('');

  const REASONS = [
    '廣告或垃圾訊息',
    '攻擊性言論',
    '醫療謠言或錯誤資訊',
    '涉及個人隱私',
    '其他'
  ];

  const handleSubmit = () => {
    alert('✅ 檢舉已送出，我們將盡快審核。');
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-[2px] animate-fadeIn p-5">
      <div className="bg-white w-full max-w-[340px] rounded-[20px] p-6 shadow-2xl flex flex-col animate-scaleIn">
        
        <h2 className="text-[18px] font-bold text-gray-900 mb-1 tracking-wide">檢舉這篇文章</h2>
        <p className="text-[14px] text-gray-500 font-medium mb-5">請選擇檢舉原因：</p>

        <div className="flex flex-col gap-1 mb-2">
          {REASONS.map(reason => (
            <label key={reason} className="flex items-center gap-3 py-2.5 cursor-pointer group">
              <div className={`w-5 h-5 rounded-full border-2 flex justify-center items-center transition-colors ${selectedReason === reason ? 'border-[#E74C3C]' : 'border-gray-300 group-hover:border-gray-400'}`}>
                {selectedReason === reason && <div className="w-2.5 h-2.5 bg-[#E74C3C] rounded-full"></div>}
              </div>
              <span className={`text-[15px] ${selectedReason === reason ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                {reason}
              </span>
            </label>
          ))}
        </div>

        {/* 若選「其他」，顯示輸入框 */}
        {selectedReason === '其他' && (
          <textarea 
            placeholder="請描述檢舉原因..."
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 focus:bg-white transition-colors resize-none h-20 mb-2"
          ></textarea>
        )}

        {/* 按鈕區塊 */}
        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-[10px] text-[15px] font-bold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!selectedReason || (selectedReason === '其他' && !otherText.trim())}
            className={`px-5 py-2.5 rounded-[10px] text-[15px] font-bold transition-colors ${
              (!selectedReason || (selectedReason === '其他' && !otherText.trim()))
                ? 'bg-red-100 text-red-300 cursor-not-allowed'
                : 'bg-[#E74C3C] text-white hover:bg-red-600 shadow-sm'
            }`}
          >
            送出檢舉
          </button>
        </div>

      </div>
    </div>
  );
}

// ==========================================
// 主應用程式入口 (模擬 Navigation 邏輯)
// ==========================================
export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home'); // 'Home' | 'PostDetail' | 'CreatePost'
  const [postDetailData, setPostDetailData] = useState(null);

  // 模擬底部 Tab 導航
  const renderBottomTabs = () => (
    <div className="absolute bottom-0 w-full h-[70px] bg-white border-t border-gray-100 flex justify-around items-center pb-2 z-10">
      <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
        <Home size={22} />
        <span className="text-[10px] font-medium">首頁</span>
      </button>
      <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
        <Calendar size={22} />
        <span className="text-[10px] font-medium">行事曆</span>
      </button>
      <button className="flex flex-col items-center gap-1 text-[#2C3E50]">
        <Users size={22} fill="currentColor" />
        <span className="text-[10px] font-bold">交流</span>
      </button>
      <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
        <Bell size={22} />
        <span className="text-[10px] font-medium">通知</span>
      </button>
      <button className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
        <MessageSquare size={22} />
        <span className="text-[10px] font-medium">聊天</span>
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center py-8">
      {/* 模擬手機外框 */}
      <div className="w-full max-w-[400px] h-[800px] bg-white rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col font-sans border-[6px] border-gray-900">
        
        {/* 頂部狀態列示意 */}
        <div className="h-10 w-full flex justify-end items-center px-6 text-xs font-medium text-gray-800 bg-white z-20 sticky top-0">
          <span>9:41 🔋</span>
        </div>

        {/* 畫面切換邏輯 */}
        <div className="flex-1 relative overflow-hidden bg-gray-50">
          {currentScreen === 'Home' && (
            <>
              <CommunityHome navigateTo={setCurrentScreen} setPostDetailData={setPostDetailData} />
              {renderBottomTabs()}
            </>
          )}
          {currentScreen === 'PostDetail' && (
             <PostDetail navigateTo={setCurrentScreen} postData={postDetailData} />
          )}
          {currentScreen === 'CreatePost' && (
             <CreatePost navigateTo={setCurrentScreen} />
          )}
        </div>

      </div>

      {/* 隱藏滾動條與自訂動畫 CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn { animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </div>
  );
}