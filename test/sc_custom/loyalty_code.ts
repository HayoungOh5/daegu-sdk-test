// Typed Gno contract for the loyalty test suite.
// Conforms to Contract-language-support.md:
//   - package contract
//   - allowed imports only (mitum/chain, errors)
//   - scalar-only ABI inputs; composite types only in persistent state
export const LOYALTY_CODE = `package contract

import (
	"mitum/chain"
	"errors"
)

type Store struct {
	Owner    string
	Balances map[string]int64
}

var stores map[string]Store

func Initialize(ctx chain.WriteContext, storeName string) error {
	if stores == nil {
		stores = map[string]Store{}
	}
	if _, exists := stores[storeName]; exists {
		return errors.New("store name already taken")
	}
	stores[storeName] = Store{
		Owner:    ctx.GetSender(),
		Balances: map[string]int64{},
	}
	return nil
}

func JoinMembership(ctx chain.WriteContext, storeName string, user string) error {
	s, ok := stores[storeName]
	if !ok {
		return errors.New("store not found")
	}
	if _, exists := s.Balances[user]; exists {
		return errors.New("user already exists")
	}
	s.Balances[user] = 0
	stores[storeName] = s
	return nil
}

func AccumulatePoints(ctx chain.WriteContext, storeName string, user string, payment int64, rate int64) error {
	s, ok := stores[storeName]
	if !ok {
		return errors.New("store not found")
	}
	if s.Owner != ctx.GetSender() {
		return errors.New("permission denied: only store owner can accumulate points")
	}
	cur, exists := s.Balances[user]
	if !exists {
		return errors.New("user not found")
	}
	s.Balances[user] = cur + payment*rate
	stores[storeName] = s
	return nil
}

func UsePoints(ctx chain.WriteContext, storeName string, amount int64) error {
	s, ok := stores[storeName]
	if !ok {
		return errors.New("store not found")
	}
	sender := ctx.GetSender()
	cur, exists := s.Balances[sender]
	if !exists {
		return errors.New("you are not a member of this store")
	}
	if amount <= 0 {
		return errors.New("amount must be positive")
	}
	if cur < amount {
		return errors.New("insufficient points")
	}
	s.Balances[sender] = cur - amount
	stores[storeName] = s
	return nil
}

func GetBalance(ctx chain.QueryContext, storeName string, user string) (int64, bool) {
	s, ok := stores[storeName]
	if !ok {
		return 0, false
	}
	v, exists := s.Balances[user]
	if !exists {
		return 0, false
	}
	return v, true
}
`;
