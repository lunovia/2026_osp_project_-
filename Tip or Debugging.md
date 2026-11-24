# Python과 Firebase를 활용한 테스트 데이터 등록 자동화 및 오류 해결

**Category: Tip & Debugging**

## 1. 개발 배경 (Context)

우리 팀은 Flask와 Firebase Realtime Database를 활용하여 상품을 등록하고 조회하며, 상품에 대한 리뷰를 작성할 수 있는 웹 서비스인 EwhaMarket을 개발하고 있다.

프로젝트에서 상품 상세 페이지와 리뷰 상세 페이지의 구현을 담당하였다. 특히 리뷰 상세 페이지에서는 Firebase에 저장된 리뷰 데이터를 불러와 제목, 상품명, 사진, 본문, 평점 등을 사용자에게 제공해야 했다.

또한 리뷰 목록의 페이지네이션 기능을 구현하고 확인하기 위해서는 최소 다섯 개의 리뷰 데이터가 필요했다. 이에 따라 여러 개의 테스트 데이터를 효율적으로 등록할 수 있는 방법을 고민하게 되었다.

## 2. 문제 상황 및 목표 (Problem or Goal)

처음에는 Firebase Console에서 리뷰 데이터를 직접 입력하는 방식을 사용하였다. 그러나 하나의 리뷰를 등록할 때마다 제목, 상품명, 본문, 평점, 이미지 경로 등의 항목을 개별적으로 입력해야 했다.

이러한 방식은 소량의 데이터를 등록할 때는 간단하지만, 여러 개의 데이터를 생성해야 하는 상황에서는 불필요한 반복 작업이 발생한다. 또한 수동으로 데이터를 입력하는 과정에서 필드 이름을 잘못 입력하거나 특정 항목을 누락할 가능성도 있다.

따라서 Python 스크립트를 활용하여 여러 개의 리뷰 데이터를 Firebase에 한 번에 등록하고, 각각의 리뷰에 고유한 ID를 자동으로 부여하는 것을 목표로 하였다.

## 3. 테스트 데이터 등록 자동화 (Tip)

### 3-1. 기존 데이터베이스 연결 코드 재사용

먼저 프로젝트의 루트 디렉터리에 `seed_reviews.py`라는 Python 파일을 생성하였다.

기존 프로젝트에는 Firebase와의 연결을 담당하는 `database.py` 파일과 `DBhandler` 클래스가 구현되어 있었다. 따라서 새로운 데이터베이스 연결 코드를 작성하는 대신 기존 클래스를 재사용하였다.

```python
from database import DBhandler

DB = DBhandler()
```

기존 클래스를 활용하면 불필요한 코드 중복을 줄일 수 있으며, 프로젝트 전체에서 일관된 데이터베이스 연결 방식을 유지할 수 있다.

### 3-2. 테스트 데이터 구조 정의

등록할 리뷰 데이터는 Python의 리스트(List)와 딕셔너리(Dictionary)를 이용하여 구성하였다. 다음은 리뷰 데이터의 구조를 보여 주는 예시이다.

```python
reviews = [
    {
        "title": "좋은 상품이에요",
        "product_name": "cookie",
        "body": "상태가 좋고 만족스러웠어요.",
        "rating": 5,
        "img_path": ""
    },
    {
        "title": "고소하고 부드러워요",
        "product_name": "latte",
        "body": "우유 맛이 진하고 원두가 고소해요.",
        "rating": 5,
        "img_path": ""
    }
]
```

각 딕셔너리는 하나의 리뷰를 나타내며, 리스트에는 여러 개의 리뷰를 저장할 수 있다. 모든 리뷰가 동일한 필드 구조를 가지도록 구성함으로써 데이터를 일관성 있게 관리할 수 있다.

실제 테스트에서는 다섯 개의 리뷰 데이터를 준비하였다. 초기에는 데이터 등록과 조회 기능을 먼저 확인하기 위해 이미지 경로를 빈 문자열로 설정하였다.

### 3-3. Firebase의 push()를 활용한 고유 ID 생성

준비한 리뷰 데이터를 반복문을 이용하여 Firebase에 저장하였다.

```python
for review in reviews:
    DB.db.child("review").push(review)
```

`child("review")`는 Firebase Realtime Database에서 리뷰 데이터가 저장될 위치를 지정한다. `push()`는 해당 위치에 고유한 키를 생성하고 데이터를 저장하는 메서드이다.

만약 리뷰 제목을 데이터의 키로 사용한다면 서로 다른 사용자가 동일한 제목으로 리뷰를 작성했을 때 기존 데이터가 덮어써질 가능성이 있다. 반면 `push()`를 사용하면 각 리뷰에 고유한 ID가 생성되므로 이러한 키 충돌 문제를 방지할 수 있다.

또한 생성된 ID는 Flask의 동적 라우팅(Dynamic Routing)에 활용할 수 있다.

```python
@app.route("/reviews/<review_id>")
def review_detail(review_id):
    review = DB.get_review(review_id)

    if review is None:
        return "Review not found", 404

    review["review_id"] = review_id
    return render_template(
        "review_detail.html",
        review=review
    )
```

위 코드는 URL을 통해 전달받은 리뷰 ID를 이용하여 Firebase에서 해당 리뷰의 데이터를 조회한다. 이를 통해 리뷰마다 별도의 HTML 파일을 생성하지 않고도 하나의 템플릿으로 여러 리뷰의 상세 페이지를 제공할 수 있다.

## 4. 실행 과정에서 발생한 오류와 해결 방법 (Debugging)

### 4-1. Pyrebase 모듈 인식 오류

테스트 데이터를 등록하기 위해 PowerShell에서 다음 명령어를 실행하였다.

```powershell
python seed_reviews.py
```

그러나 실행 과정에서 다음과 같은 오류가 발생하였다.

```text
ModuleNotFoundError: No module named 'pyrebase'
```

이 오류는 현재 실행 중인 Python 환경에서 해당 모듈을 찾을 수 없다는 의미이다.

우리 프로젝트에서는 Python 가상환경(Virtual Environment)을 사용하고 있었지만, 가상환경이 활성화되지 않은 상태에서 스크립트를 실행하였다. 이로 인해 필요한 패키지가 설치된 환경과 실제 스크립트가 실행되는 환경이 달라졌다.

Python 가상환경은 프로젝트별로 독립적인 패키지 설치 및 관리를 가능하게 한다. 따라서 특정 패키지가 설치되어 있더라도 올바른 Python 환경에서 프로그램을 실행하지 않으면 해당 패키지를 사용할 수 없는 문제가 발생할 수 있다.

### 4-2. PowerShell 실행 정책 오류

문제를 해결하기 위해 가상환경 활성화 명령어를 실행하였다.

```powershell
.\venv\Scripts\Activate.ps1
```

그러나 Windows PowerShell의 스크립트 실행 정책으로 인해 가상환경 활성화가 차단되는 문제가 발생하였다.

```text
PSSecurityException
FullyQualifiedErrorId : UnauthorizedAccess
```

이는 Python 코드 자체의 문제가 아니라 PowerShell에서 스크립트 실행을 제한하고 있기 때문에 발생한 오류이다.

이를 해결하기 위해 다음 명령어를 사용하였다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

`-Scope Process` 옵션은 실행 정책 변경의 범위를 현재 PowerShell 프로세스로 제한한다. 따라서 시스템 전체의 실행 정책을 영구적으로 변경하지 않고 현재 터미널에서만 가상환경 활성화 스크립트를 실행할 수 있다.

이후 가상환경 활성화 명령어를 다시 실행하였다.

```powershell
.\venv\Scripts\Activate.ps1
```

터미널 앞에 `(venv)`가 표시되는 것을 통해 가상환경이 활성화되었음을 확인하였다.

### 4-3. 모듈 정상 작동 확인

가상환경 활성화 이후 Pyrebase 모듈을 정상적으로 불러올 수 있는지 확인하기 위해 다음 명령어를 실행하였다.

```powershell
python -c "import pyrebase; print('Pyrebase import successful')"
```

실행 결과는 다음과 같았다.

```text
Pyrebase import successful
```

이를 통해 활성화된 Python 환경에서 Pyrebase 모듈을 정상적으로 사용할 수 있음을 확인하였다.

만약 가상환경을 활성화한 이후에도 모듈을 찾을 수 없다면 다음 명령어를 이용하여 프로젝트에 필요한 패키지를 설치할 수 있다.

```powershell
python -m pip install -r requirements.txt
```

`requirements.txt`를 활용하면 프로젝트에 필요한 패키지를 한 번에 설치할 수 있으며, 팀원들이 일관된 개발 환경을 구성하는 데에도 도움이 된다.

**[스크린샷 1 삽입: PowerShell 실행 정책 오류 해결 및 Pyrebase 모듈 정상 작동 확인]**

*Figure 1. Resolving the PowerShell execution policy error and verifying the Pyrebase module.*

## 5. 구현 결과 (Result)

Python 스크립트를 활용하여 다섯 개의 테스트 리뷰 데이터를 한 번에 등록할 수 있었다. 각 리뷰에는 Firebase의 `push()` 메서드를 통해 고유한 ID가 생성되었다.

기존에는 Firebase Console에서 리뷰 정보를 반복적으로 입력해야 했지만, 자동화 스크립트를 활용하면 하나의 명령어로 여러 개의 데이터를 등록할 수 있다.

아래는 Firebase Realtime Database에 저장된 리뷰 데이터의 모습이다. 다섯 개의 리뷰가 서로 다른 ID를 가지고 있으며, 개별 리뷰에는 본문, 이미지 경로, 상품명, 평점, 제목이 저장되어 있는 것을 확인할 수 있다.

**[스크린샷 2 삽입: Firebase Realtime Database에 저장된 리뷰 데이터]**

*Figure 2. Review data stored in Firebase Realtime Database with unique IDs.*

다만 현재 스크립트는 실행할 때마다 새로운 고유 ID를 생성하기 때문에 동일한 스크립트를 반복적으로 실행하면 중복된 내용의 리뷰가 등록될 수 있다.

따라서 테스트 데이터 등록 스크립트는 필요한 경우에만 실행해야 한다. 향후에는 기존 데이터를 확인하거나 테스트 데이터를 별도의 데이터베이스 경로에서 관리하는 방식으로 개선할 수 있다.

## 6. 배운 점 (What I Learned)

이번 개발 과정에서 반복적인 작업을 자동화하는 것이 개발 효율성을 높이는 중요한 방법이라는 점을 배웠다. 간단한 Python 스크립트를 활용하는 것만으로도 테스트 데이터를 등록하는 과정에서 발생하는 반복 작업을 줄이고, 일정한 구조의 데이터를 관리할 수 있었다.

또한 Firebase의 `push()`를 사용하면 별도의 ID 생성 로직 없이 각 데이터에 고유한 키를 부여할 수 있다는 사실을 알게 되었다. 이러한 고유 ID는 단순한 데이터 저장뿐만 아니라 Flask에서 개별 리뷰를 조회하고 상세 페이지를 제공하는 과정에서도 중요한 역할을 한다.

Pyrebase 모듈 오류와 PowerShell 실행 정책 오류를 해결하는 과정에서는 프로그램의 실행 환경을 관리하는 것이 코드 작성만큼 중요하다는 점을 배웠다. 오류가 발생했을 때 무조건 코드를 수정하거나 패키지를 다시 설치하기보다는, 먼저 오류 메시지를 확인하고 문제가 발생한 환경을 파악해야 한다.

앞으로도 반복적인 개발 작업을 자동화하고, 프로젝트의 실행 환경과 패키지 의존성을 체계적으로 관리하여 개발 과정의 효율성과 안정성을 높이고자 한다.

## 7. 참고 자료 (References)

- Firebase Realtime Database: https://firebase.google.com/docs/database
- Python Virtual Environments: https://docs.python.org/3/library/venv.html
- Microsoft PowerShell Execution Policies: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies
- Pyrebase4: https://github.com/nhorvath/Pyrebase4
- EwhaMarket Project: https://github.com/lunovia/2026_osp_project_-
