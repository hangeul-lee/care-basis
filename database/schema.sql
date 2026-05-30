CREATE DATABASE IF NOT EXISTS care_basis
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE care_basis;

CREATE TABLE IF NOT EXISTS babies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  birth_date DATE NOT NULL,
  sex ENUM('female', 'male', 'unspecified') NOT NULL DEFAULT 'unspecified',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routine_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  baby_id BIGINT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  entry_time TIME NOT NULL,
  category VARCHAR(40) NOT NULL,
  amount VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_routine_day (baby_id, entry_date, entry_time),
  CONSTRAINT fk_routine_baby
    FOREIGN KEY (baby_id) REFERENCES babies(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_plan_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  baby_id BIGINT UNSIGNED NOT NULL,
  plan_time TIME NOT NULL,
  category VARCHAR(40) NOT NULL,
  amount VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_routine_plan (baby_id, plan_time),
  CONSTRAINT fk_routine_plan_baby
    FOREIGN KEY (baby_id) REFERENCES babies(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS info_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  summary TEXT NOT NULL,
  source_institution VARCHAR(160) NOT NULL,
  source_url VARCHAR(600) NOT NULL,
  last_verified_at DATE NOT NULL,
  trust_grade ENUM('A+', 'A', 'B') NOT NULL DEFAULT 'A',
  tags JSON NOT NULL,
  is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_source_url (source_url),
  FULLTEXT KEY ft_info_search (title, summary, source_institution)
);

CREATE TABLE IF NOT EXISTS checklist_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  baby_id BIGINT UNSIGNED NOT NULL,
  item_id VARCHAR(80) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_baby_item (baby_id, item_id),
  CONSTRAINT fk_checklist_baby
    FOREIGN KEY (baby_id) REFERENCES babies(id)
    ON DELETE CASCADE
);

INSERT IGNORE INTO info_documents
  (title, summary, source_institution, source_url, last_verified_at, trust_grade, tags, is_trusted)
VALUES
  (
    '어린이 표준 예방접종 일정표',
    '질병관리청 예방접종도우미의 어린이 표준 예방접종 일정표입니다. 월령별 예방접종 확인과 지연 접종 시 의료진 상담 안내에 사용합니다.',
    '질병관리청 예방접종도우미',
    'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuCd=115&menuLv=1',
    '2026-05-28',
    'A+',
    JSON_ARRAY('예방접종', '월령', '질병관리청', '체크리스트'),
    TRUE
  ),
  (
    '필수예방접종 사전알림 안내',
    '필수예방접종 대상 아동의 접종 지연과 누락을 줄이기 위한 사전알림 서비스 안내입니다.',
    '질병관리청 예방접종도우미',
    'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuCd=138&menuLv=1',
    '2026-05-28',
    'A+',
    JSON_ARRAY('예방접종', '알림', '질병관리청'),
    TRUE
  ),
  (
    '영유아 건강검진 실시 기준',
    '영유아건강검진의 대상, 차수, 검진 항목 등 제도적 기준을 확인할 수 있는 국민건강보험공단 건강Law 자료입니다.',
    '국민건강보험공단 건강Law',
    'https://www.nhis.or.kr/lm/lmxsrv/law/lawFullContent.do?SEQ=80&SEQ_HISTORY=595069',
    '2026-05-28',
    'A+',
    JSON_ARRAY('건강검진', '국민건강보험공단', '월령', '발달'),
    TRUE
  ),
  (
    '1~3개월 수면 특성',
    '생후 1~3개월 아기의 수면 시간, 얕은 잠과 깊은 잠, 수면 주기 특성을 설명하는 임신육아종합포털 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=431',
    '2026-05-28',
    'A',
    JSON_ARRAY('수면', '1~3개월', '아이사랑', '루틴'),
    TRUE
  ),
  (
    '1~3개월 수유량 안내',
    '모유수유와 분유수유의 빈도와 수유량을 월령 특성에 맞게 확인할 수 있는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=429',
    '2026-05-28',
    'A',
    JSON_ARRAY('수유', '1~3개월', '아이사랑', '루틴'),
    TRUE
  ),
  (
    '1~3개월 발달과 놀이',
    '생후 1~3개월 아기의 시각·청각 반응, 상호작용, 돌봄자가 관찰할 발달 신호를 확인하는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=289',
    '2026-05-28',
    'A',
    JSON_ARRAY('발달', '놀이', '1~3개월', '아이사랑'),
    TRUE
  ),
  (
    '신생아 돌보기 기본 안전',
    '영아 수면 공간, 목욕, 외출 전후 돌봄에서 점검할 기본 안전 항목을 확인하는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=428',
    '2026-05-28',
    'A',
    JSON_ARRAY('안전', '수면', '목욕', '아이사랑'),
    TRUE
  ),
  (
    '4~6개월 안전 돌보기',
    '카시트, 수면 환경, 생활 안전 등 4~6개월 영아를 돌볼 때 확인할 안전 항목을 정리한 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=436',
    '2026-05-28',
    'A',
    JSON_ARRAY('안전', '4~12개월', '4~6개월', '아이사랑', '카시트'),
    TRUE
  ),
  (
    '4~6개월 수유와 이유식 전환',
    '4~6개월 아기의 수유 리듬, 이유식 시작 전 준비 상태, 보호자가 기록하면 좋은 식사 반응을 정리한 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=437',
    '2026-05-28',
    'A',
    JSON_ARRAY('수유', '이유식', '4~12개월', '4~6개월', '아이사랑'),
    TRUE
  ),
  (
    '4~6개월 배설과 수면',
    '4~6개월 아기의 배설, 낮잠, 밤잠 변화와 보호자가 생활 리듬을 기록할 때 참고할 수 있는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=438',
    '2026-05-28',
    'A',
    JSON_ARRAY('수면', '생활리듬', '4~12개월', '4~6개월', '아이사랑'),
    TRUE
  ),
  (
    '7~9개월 놀이와 학습',
    '기기, 앉기, 손 사용이 늘어나는 7~9개월 아기에게 맞는 놀이, 장난감, 상호작용 방법을 정리한 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=446',
    '2026-05-28',
    'A',
    JSON_ARRAY('놀이', '학습', '4~12개월', '7~9개월', '아이사랑'),
    TRUE
  ),
  (
    '10~12개월 발달',
    '10~12개월 아기의 신체 성장, 인지, 언어, 사회성 발달과 상담이 필요한 신호를 확인할 수 있는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=292',
    '2026-05-28',
    'A',
    JSON_ARRAY('발달', '4~12개월', '10~12개월', '아이사랑'),
    TRUE
  ),
  (
    '10~12개월 건강과 이유식',
    '돌 전 생우유 주의, 과일 주스 섭취, 알레르기 가능 음식 시도 등 10~12개월 건강과 식사 관리 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=451',
    '2026-05-28',
    'A',
    JSON_ARRAY('건강', '이유식', '4~12개월', '10~12개월', '아이사랑'),
    TRUE
  ),
  (
    '10~12개월 행동과 안전',
    '기기와 잡고 서기가 활발해지는 시기의 질식, 작은 물건, 낮은 가구 등 가정 안전 점검 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=448',
    '2026-05-28',
    'A',
    JSON_ARRAY('안전', '행동', '4~12개월', '10~12개월', '아이사랑'),
    TRUE
  ),
  (
    '13~24개월 놀이와 학습',
    '걸음마 이후 아이의 탐색, 언어, 놀이 확장과 가정에서 관찰할 학습 신호를 확인할 수 있는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=460',
    '2026-05-28',
    'A',
    JSON_ARRAY('놀이', '학습', '13~24개월', '아이사랑'),
    TRUE
  ),
  (
    '25~36개월 관계와 소통',
    '자아개념, 기질, 또래 관계, 부모의 반응 방식 등 만 3세 전후 아이와의 소통을 돕는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=462',
    '2026-05-28',
    'A',
    JSON_ARRAY('관계', '소통', '25~36개월', '기질'),
    TRUE
  ),
  (
    '만 3~5세 대소근육 가정놀이',
    '취학 전 유아의 대근육·소근육 발달을 돕는 가정연계 놀이 활동 예시를 제공하는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=592',
    '2026-05-28',
    'A',
    JSON_ARRAY('놀이', '발달', '만3~5세', '소근육'),
    TRUE
  ),
  (
    '만 4~5세 자조기술 가정놀이',
    '씻기, 옷 입기 등 취학 전 생활 자립을 연습하는 가정연계 놀이 활동을 제공하는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=593',
    '2026-05-28',
    'A',
    JSON_ARRAY('생활습관', '자조기술', '만4~5세', '놀이'),
    TRUE
  ),
  (
    '이른둥이 발달과 돌보기',
    '이른둥이의 발달 추적, 활동 시간, 놀이 도구, 부모가 관찰할 발달 신호를 정리한 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=419',
    '2026-05-28',
    'A',
    JSON_ARRAY('이른둥이', '발달', '놀이', '추적관리'),
    TRUE
  ),
  (
    '발달지연 가능성 영유아 지원 안내',
    '언어, 사회성, 행동 발달이 늦어 보일 때 확인할 신호와 국가 지원 안내로 연결되는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://www.childcare.go.kr/?menuno=654',
    '2026-05-28',
    'A',
    JSON_ARRAY('발달지연', '상담', '장애아육아', '지원'),
    TRUE
  ),
  (
    '어린이집 입소대기 안내',
    '어린이집 선택, 입소대기 신청, 아동정보 입력 등 입소 전 부모가 확인할 절차를 제공하는 아이사랑 자료입니다.',
    '임신육아종합포털 아이사랑',
    'https://tmcis.childcare.go.kr/nursery/enterwait/enterwait.do',
    '2026-05-28',
    'A',
    JSON_ARRAY('어린이집', '입소대기', '보육', '절차'),
    TRUE
  ),
  (
    '만 3~5세 보육과정과 누리과정',
    '만 3~5세 유아의 건강, 놀이, 사회관계, 일상생활 균형을 다루는 어린이집 보육과정 안내입니다.',
    '충남육아종합지원센터',
    'https://chungnam.childcare.go.kr/lchungnam/30000/d14_30075/d14_30076.jsp',
    '2026-05-28',
    'A',
    JSON_ARRAY('누리과정', '만3~5세', '어린이집', '보육'),
    TRUE
  ),
  (
    '발달지연 영유아 국가 지원 종합안내서',
    '발달지연 가능성 또는 발달 장애가 있는 영유아와 가족에게 필요한 국가 지원사업을 종합한 중앙육아종합지원센터 PDF 자료입니다.',
    '중앙육아종합지원센터',
    'https://central.childcare.go.kr/ccef/community/common/DownloadBoardFile.jsp?ATCHMNFLSEQ=1&BBSGB=50&BID=86274',
    '2026-05-28',
    'A',
    JSON_ARRAY('발달지연', '국가지원', 'PDF', '상담'),
    TRUE
  ),
  (
    '영아기 이유식과 영양관리',
    '이유식 초기, 중기, 후기의 월령 구분과 영아기 영양관리 고려사항을 제공하는 식품의약품안전처 어린이·사회복지급식관리지원센터 자료입니다.',
    '식품의약품안전처 어린이·사회복지급식관리지원센터',
    'https://dietary4u.mfds.go.kr/menu.es?mid=a10702060000',
    '2026-05-28',
    'A+',
    JSON_ARRAY('이유식', '영양', '식품의약품안전처', '월령'),
    TRUE
  ),
  (
    '영아기 식단정보',
    '생후 4~6개월 이후 보충이 필요한 영양소와 영아기 식단 준비 시 참고할 사항을 제공하는 식품의약품안전처 자료입니다.',
    '식품의약품안전처 어린이·사회복지급식관리지원센터',
    'https://dietary4u.mfds.go.kr/menu.es?mid=a10702050000',
    '2026-05-28',
    'A+',
    JSON_ARRAY('영양', '이유식', '영아기', '식품의약품안전처'),
    TRUE
  ),
  (
    '건강기능식품 이상사례 관리체계',
    '건강기능식품 섭취 후 이상사례의 정의와 관리체계를 설명하는 식품안전나라 자료입니다. 영유아에게 건강기능식품을 임의 섭취시키지 않도록 확인용으로 사용합니다.',
    '식품의약품안전처 식품안전나라',
    'https://www.foodsafetykorea.go.kr/portal/sideeffect/information.do',
    '2026-05-28',
    'A+',
    JSON_ARRAY('약', '건강기능식품', '안전', '식품안전나라'),
    TRUE
  ),
  (
    '소아 질환의 특징과 합리적 접근',
    '소아 발열과 흔한 증상에 대한 접근을 다룬 약학정보원 PDF 자료입니다. 응급 판단은 의료진 상담과 119 안내를 우선합니다.',
    '약학정보원',
    'https://www.health.kr/Menu.PharmReview/_uploadfiles/170116%20%EC%86%8C%EC%95%84%20%EC%A7%88%ED%99%98_%EA%B9%80%EC%84%B1%EC%B2%A0_final.pdf',
    '2026-05-28',
    'A',
    JSON_ARRAY('소아질환', '발열', '응급', 'PDF'),
    TRUE
  );
